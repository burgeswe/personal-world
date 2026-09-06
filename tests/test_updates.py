"""Safe updates: the demonstrated reference path.

Covers the full state machine with FakeUpdateProvider AND the real
ComposeUpdateProvider on a temp compose fixture -- the same suite must
pass for both (provider-neutral contract). Docker is optional: the
compose fixture path parses the file directly when the docker client is
absent, and one optional integration test exercises a real ``docker
compose config`` when it is present (robust to CI lacking docker).
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.cli import main as cli_main  # noqa: E402
from personal_world.envelope import EXIT_DENIED, EXIT_ERROR, EXIT_OK  # noqa: E402
from personal_world.journal import Journal  # noqa: E402
from personal_world.model import JournalKind  # noqa: E402
from personal_world.updates import (  # noqa: E402
    ComposeUpdateProvider,
    FakeUpdateProvider,
    UpdateManager,
    UpdateRefused,
    UpdateRollbackFailed,
    build_provider,
)


def _journal(tmp_path):
    return Journal(tmp_path / "journal.ndjson")


def _summary(event) -> str:
    return event.summary


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def compose_fixture(tmp_path: Path, image="old:1.0") -> Path:
    """A temp directory holding a trivial compose project; its 'update'
    is changing the web service's image tag."""
    proj = tmp_path / "proj"
    proj.mkdir()
    (proj / "compose.yaml").write_text(yaml.safe_dump({
        "services": {
            "web": {"image": image, "ports": ["8000:8000"]},
        },
    }))
    # desired-version config the provider reads (same wiring as a real
    # install: config/updates-desired.json next to connections.json)
    config = tmp_path / "config"
    config.mkdir(exist_ok=True)
    (config / "updates-desired.json").write_text(json.dumps({"web": "new:2.0"}))
    return proj


def make_pair(kind: str, tmp_path: Path, project_dir: Path | None = None):
    """Build (provider, manager, probe) for either fixture kind.

    ``probe`` returns the live target state so assertions can be
    provider-neutral."""
    if kind == "fake":
        provider = FakeUpdateProvider(
            state={"web": {"image": "old:1.0"}}, desired={"web": "new:2.0"})
        probe = lambda: provider.state["web"]["image"]  # noqa: E731
        return provider, UpdateManager(provider, _journal(tmp_path)), probe
    if kind == "compose":
        desired = {"web": "new:2.0"}
        provider = ComposeUpdateProvider(project_dir, desired)
        probe = lambda: yaml.safe_load(  # noqa: E731
            (project_dir / "compose.yaml").read_text()
        )["services"]["web"]["image"]
        return provider, UpdateManager(provider, _journal(tmp_path)), probe
    raise ValueError(kind)


KINDS = ["fake", "compose"]


@pytest.fixture(params=KINDS, ids=["fake", "compose-fixture"])
def rig(request, tmp_path):
    if request.param == "compose":
        proj = compose_fixture(tmp_path)
        return make_pair("compose", tmp_path, proj)
    return make_pair("fake", tmp_path)


# ---------------------------------------------------------------------------
# The demonstrated reference path (both providers)
# ---------------------------------------------------------------------------


class TestReferencePath:
    def test_full_state_machine_happy_path(self, rig, tmp_path):
        """check -> preview -> apply -> verify ok -> journal trail.
        The one flow this lane exists to demonstrate."""
        provider, mgr, probe = rig
        before = probe()

        c = mgr.check("web")
        assert c.current == before
        assert c.available == "new:2.0"
        assert c.provider == provider.name

        p = mgr.preview("web")
        assert p.mutations == ["compose.yaml: services.web.image "
                               "old:1.0 -> new:2.0"] or p.mutations, p.mutations
        assert p.reversible is True

        result = mgr.apply("web", confirm=True)
        assert result.applied is True
        assert result.verified is True
        assert result.rolled_back is False
        assert probe() == "new:2.0"
        assert result.journal_ref

        events = list(mgr.journal.events())
        text = "\n".join(_summary(e) for e in events)
        assert "check target=web" in text
        assert "preview target=web" in text
        assert "known-good recorded" in text
        assert "applied target=web" in text
        assert "verify target=web after apply: ok" in text
        assert "update complete target=web (verified)" in text
        assert events[-1].provenance.source == f"updates/{provider.name}"

    def test_check_and_preview_are_read_only(self, rig):
        """check + preview must never mutate the target state."""
        provider, mgr, probe = rig
        before = probe()
        mgr.check("web")
        mgr.preview("web")
        assert probe() == before
        if hasattr(provider, "snapshot"):
            assert provider.snapshot() == {"web": {"image": before}}

    def test_apply_without_confirmation_refused(self, rig, tmp_path):
        provider, mgr, probe = rig
        mgr.check("web")
        mgr.preview("web")
        with pytest.raises(UpdateRefused):
            mgr.apply("web", confirm=False)
        assert probe() == "old:1.0"
        text = "\n".join(_summary(e) for e in mgr.journal.events())
        assert "refused: no explicit confirmation" in text

    def test_apply_without_preview_refused(self, rig):
        """The hard rule: no preview in this session -> no apply."""
        provider, mgr, probe = rig
        with pytest.raises(UpdateRefused, match="no preview"):
            mgr.apply("web", confirm=True)
        assert probe() == "old:1.0"
        text = "\n".join(_summary(e) for e in mgr.journal.events())
        assert "refused: no preview in this session" in text

    def test_stale_preview_refused(self, rig, tmp_path):
        """Target drifts after preview -> apply refused."""
        provider, mgr, probe = rig
        mgr.preview("web")
        if isinstance(provider, FakeUpdateProvider):
            provider.state["web"]["image"] = "drifted:9.9"
        else:
            data = yaml.safe_load((provider.compose_file).read_text())
            data["services"]["web"]["ports"] = ["9999:9999"]
            provider.compose_file.write_text(yaml.safe_dump(data))
        with pytest.raises(UpdateRefused, match="stale"):
            mgr.apply("web", confirm=True)
        assert probe() != "new:2.0"

    def test_verify_fail_triggers_automatic_rollback(self, tmp_path):
        """verify fails -> automatic rollback -> state returns to
        known-good; result is NEVER a false success."""
        provider = FakeUpdateProvider(
            state={"web": {"image": "old:1.0"}}, desired={"web": "new:2.0"})
        provider.fail_verify = True
        mgr = UpdateManager(provider, _journal(tmp_path))
        mgr.preview("web")
        result = mgr.apply("web", confirm=True)
        assert result.applied is True
        assert result.verified is False
        assert result.rolled_back is True
        assert provider.state["web"]["image"] == "old:1.0"
        assert result.error and "verify failed" in result.error
        text = "\n".join(_summary(e) for e in mgr.journal.events())
        assert "verify failed target=web; automatic rollback starting" in text
        assert "automatic rollback ok target=web" in text

    def test_verify_fail_and_rollback_fail_is_loud(self, tmp_path):
        """Both fail -> loud structured error, journal records it,
        success is never declared."""
        provider = FakeUpdateProvider(
            state={"web": {"image": "old:1.0"}}, desired={"web": "new:2.0"})
        provider.fail_verify = True
        provider.fail_rollback = True
        mgr = UpdateManager(provider, _journal(tmp_path))
        mgr.preview("web")
        with pytest.raises(UpdateRollbackFailed, match="rollback"):
            mgr.apply("web", confirm=True)
        text = "\n".join(_summary(e) for e in mgr.journal.events())
        assert "ROLLBACK FAILED target=web" in text
        assert "manual intervention needed" in text
        # no 'update complete' ever appeared
        assert "update complete" not in text

    def test_manual_rollback_restores_known_good(self, rig, tmp_path):
        provider, mgr, probe = rig
        mgr.preview("web")
        mgr.apply("web", confirm=True)
        assert probe() == "new:2.0"
        result = mgr.rollback("web")
        assert result.rolled_back is True
        assert probe() == "old:1.0"
        text = "\n".join(_summary(e) for e in mgr.journal.events())
        assert "manual rollback target=web" in text

    def test_rollback_without_known_good_refused(self, rig):
        provider, mgr, probe = rig
        with pytest.raises(UpdateRefused):
            mgr.rollback("web")
        assert probe() == "old:1.0"

    def test_journal_trail_is_complete(self, rig, tmp_path):
        """The full lifecycle leaves a complete, ordered journal trail
        through the ONE existing journal."""
        provider, mgr, probe = rig
        mgr.check("web")
        mgr.preview("web")
        result = mgr.apply("web", confirm=True)
        n_after_apply = sum(1 for _ in mgr.journal.events())
        mgr.rollback("web")
        events = list(mgr.journal.events())
        start = len(events) - 1  # rollback wrote exactly one event
        assert result.journal_ref == f"entries[2:{start}]"
        kinds = [e.kind for e in events]
        assert JournalKind.OBSERVATION in kinds
        assert JournalKind.RECOMMENDATION in kinds
        assert JournalKind.APPROVAL in kinds
        assert JournalKind.PROVIDER_ACTION in kinds
        assert JournalKind.HEALTH in kinds
        assert JournalKind.RECONCILIATION in kinds
        assert JournalKind.SECURITY not in kinds
        # every updates event carries the provider-namespaced source
        for e in events:
            assert e.provenance.source.startswith("updates/")

    def test_status_reflects_session_state(self, rig, tmp_path):
        provider, mgr, probe = rig
        s = mgr.status(live=True)
        assert s["provider"] == provider.name
        assert s["targets"]["web"]["available"] == "new:2.0"
        assert s["targets"]["web"]["has_preview"] is False
        mgr.preview("web")
        s = mgr.status(live=False)
        assert s["targets"]["web"]["has_preview"] is True
        # status never mutated anything
        assert probe() == "old:1.0"


# ---------------------------------------------------------------------------
# Provider-neutrality + session semantics
# ---------------------------------------------------------------------------


class TestContract:
    def test_second_provider_passes_same_suite(self, tmp_path):
        """Parametrized rig already proves two providers satisfy the
        same contract; this pins the contract shape itself."""
        for p in (FakeUpdateProvider(), ComposeUpdateProvider(
                compose_fixture(tmp_path), {"web": "new:2.0"})):
            assert hasattr(p, "targets") and callable(p.targets)
            assert hasattr(p, "check") and callable(p.check)
            assert hasattr(p, "preview") and callable(p.preview)
            assert hasattr(p, "known_good") and callable(p.known_good)
            assert hasattr(p, "apply") and callable(p.apply)
            assert hasattr(p, "verify") and callable(p.verify)
            assert hasattr(p, "rollback") and callable(p.rollback)

    def test_session_persists_preview_across_managers(self, tmp_path):
        """CLI invocations are separate processes; the session file must
        carry the preview + known-good across them."""
        provider = FakeUpdateProvider(
            state={"web": {"image": "old:1.0"}}, desired={"web": "new:2.0"})
        spath = tmp_path / "session.json"
        m1 = UpdateManager(provider, _journal(tmp_path), session_path=spath)
        m1.preview("web")
        m2 = UpdateManager(provider, _journal(tmp_path), session_path=spath)
        result = m2.apply("web", confirm=True)
        assert result.applied and result.verified
        assert provider.state["web"]["image"] == "new:2.0"

    def test_session_refuses_cross_provider_replay(self, tmp_path):
        """A session written by provider A cannot satisfy provider B's
        apply (provider name is part of the session payload)."""
        a = FakeUpdateProvider()
        a.name = "fake-a"
        b = FakeUpdateProvider()
        b.name = "fake-b"
        spath = tmp_path / "session.json"
        UpdateManager(a, _journal(tmp_path), session_path=spath).preview("web")
        m2 = UpdateManager(b, _journal(tmp_path), session_path=spath)
        with pytest.raises(UpdateRefused, match="no preview"):
            m2.apply("web", confirm=True)

    def test_nothing_to_apply_refused(self, tmp_path):
        provider = FakeUpdateProvider(
            state={"web": {"image": "old:1.0"}}, desired={"web": "old:1.0"})
        mgr = UpdateManager(provider, _journal(tmp_path))
        mgr.preview("web")
        with pytest.raises(UpdateRefused, match="nothing to apply"):
            mgr.apply("web", confirm=True)

    def test_apply_failure_propagates_and_is_journaled(self, tmp_path):
        provider = FakeUpdateProvider()
        mgr = UpdateManager(provider, _journal(tmp_path))
        mgr.preview("web")

        def boom(target, preview):
            raise RuntimeError("apply exploded")

        provider.apply = boom
        with pytest.raises(RuntimeError):
            mgr.apply("web", confirm=True)
        text = "\n".join(_summary(e) for e in mgr.journal.events())
        assert "apply target=web failed: apply exploded" in text


# ---------------------------------------------------------------------------
# ComposeUpdateProvider specifics
# ---------------------------------------------------------------------------


class TestComposeProvider:
    def test_targets_intersect_desired(self, tmp_path):
        proj = tmp_path / "proj"
        proj.mkdir()
        (proj / "compose.yaml").write_text(yaml.safe_dump({
            "services": {
                "web": {"image": "old:1.0"},
                "unwanted": {"image": "old:1.0"},
            },
        }))
        p = ComposeUpdateProvider(proj, {"web": "new:2.0"})
        assert p.targets() == ["web"]

    def test_check_available_none_when_current(self, tmp_path):
        proj = compose_fixture(tmp_path, image="new:2.0")
        p = ComposeUpdateProvider(proj, {"web": "new:2.0"})
        assert p.check("web").available is None

    def test_known_good_restores_exact_bytes(self, tmp_path):
        proj = compose_fixture(tmp_path)
        p = ComposeUpdateProvider(proj, {"web": "new:2.0"})
        kg = p.known_good("web")
        before = (proj / "compose.yaml").read_text()
        p.apply("web", p.preview("web"))
        assert (proj / "compose.yaml").read_text() != before
        p.rollback("web", kg)
        assert (proj / "compose.yaml").read_text() == before

    def test_missing_project_dir_yields_no_targets(self, tmp_path):
        p = ComposeUpdateProvider(tmp_path / "absent", {"web": "new:2.0"})
        assert p.targets() == []
        assert p.check("web").available is None

    def test_build_provider_fake_and_none(self, tmp_path, monkeypatch):
        assert isinstance(build_provider(provider="fake"), FakeUpdateProvider)
        monkeypatch.delenv("PW_UPDATES_PROJECT_DIR", raising=False)
        assert build_provider(provider="compose") is None

    def test_build_provider_compose_with_desired_file(self, tmp_path, monkeypatch):
        proj = compose_fixture(tmp_path)
        config = tmp_path / "config"
        (config / "updates-desired.json").write_text(
            json.dumps({"web": "new:2.0"}))
        monkeypatch.setenv("PW_UPDATES_PROJECT_DIR", str(proj))
        p = build_provider(config_dir=config, provider="compose")
        assert isinstance(p, ComposeUpdateProvider)
        assert p.check("web").available == "new:2.0"

    def test_verify_via_docker_compose_config_when_available(self, tmp_path):
        """Optional integration: exercises the real `docker compose
        config` verify path. Skipped when the docker client is absent;
        the parse-fallback path is covered by the rig tests above."""
        docker = shutil.which("docker")
        if not docker:
            pytest.skip("docker client not installed")
        proj = compose_fixture(tmp_path)
        p = ComposeUpdateProvider(proj, {"web": "new:2.0"})
        kg = p.known_good("web")
        p.apply("web", p.preview("web"))
        try:
            assert p.verify("web") is True
            # a malformed file must fail verify
            (proj / "compose.yaml").write_text("services: [oops")
            assert p.verify("web") is False
        finally:
            p.rollback("web", kg)
        # after rollback the target is intentionally back at old:1.0 --
        # verify() answers "is the target at the desired update version",
        # so False is the correct (unapplied) answer, not a false negative
        assert p.verify("web") is False
        assert p.check("web").current == "old:1.0"

    def test_verify_fallback_without_docker(self, tmp_path, monkeypatch):
        proj = compose_fixture(tmp_path)
        monkeypatch.delenv("PATH", raising=False)
        monkeypatch.setenv("PATH", "/nonexistent")
        p = ComposeUpdateProvider(proj, {"web": "new:2.0"}, docker_bin=None)
        p.apply("web", p.preview("web"))
        assert p.verify("web") is True


# ---------------------------------------------------------------------------
# CLI surface
# ---------------------------------------------------------------------------


class TestCli:
    def _cli(self, tmp_path, monkeypatch, argv):
        monkeypatch.setenv("PW_UPDATES_PROJECT_DIR", str(tmp_path / "proj"))
        monkeypatch.setenv("PW_CONFIG_DIR", str(tmp_path / "config"))
        argv = ["--config-dir", str(tmp_path / "config"), *argv]
        return cli_main([
            "--data-dir", str(tmp_path / "data"),
            *argv,
        ])

    def _capped(self, capsys):
        return json.loads(capsys.readouterr().out)

    def test_cli_full_flow(self, tmp_path, monkeypatch, capsys):
        """The CLI demonstrates the same state machine end-to-end,
        including the persisted session across process invocations."""
        proj = compose_fixture(tmp_path)
        rc = self._cli(tmp_path, monkeypatch, ["updates", "check", "web", "--json"])
        assert rc == EXIT_OK
        check = self._capped(capsys)
        assert check["data"]["available"] == "new:2.0"

        rc = self._cli(tmp_path, monkeypatch,
                       ["updates", "preview", "web", "--json"])
        assert rc == EXIT_OK
        preview = self._capped(capsys)
        assert preview["data"]["mutations"], preview

        rc = self._cli(tmp_path, monkeypatch,
                       ["updates", "apply", "web", "--yes", "--json"])
        assert rc == EXIT_OK
        applied = self._capped(capsys)
        assert applied["status"] == "verified"
        assert applied["data"]["applied"] is True
        assert yaml.safe_load((proj / "compose.yaml").read_text())[
            "services"]["web"]["image"] == "new:2.0"

        rc = self._cli(tmp_path, monkeypatch, ["updates", "status", "--json"])
        assert rc == EXIT_OK
        st = self._capped(capsys)
        assert st["data"]["targets"]["web"]["last"]["applied"] is True

        rc = self._cli(tmp_path, monkeypatch, ["updates", "rollback", "web", "--json"])
        assert rc == EXIT_OK
        rb = self._capped(capsys)
        assert rb["data"]["rolled_back"] is True
        assert yaml.safe_load((proj / "compose.yaml").read_text())[
            "services"]["web"]["image"] == "old:1.0"

        # journal trail via the standard journal command
        rc = cli_main([
            "--data-dir", str(tmp_path / "data"),
            "--config-dir", str(tmp_path / "config"),
            "journal", "--json", "-n", "50",
        ])
        assert rc == EXIT_OK
        events = self._capped(capsys)["data"]
        text = "\n".join(e["summary"] for e in events)
        for needle in ("check target=web", "preview target=web",
                       "known-good recorded", "applied target=web",
                       "verify target=web after apply: ok",
                       "manual rollback target=web"):
            assert needle in text, needle

    def test_cli_apply_without_preview_refused(self, tmp_path, monkeypatch, capsys):
        compose_fixture(tmp_path)
        rc = self._cli(tmp_path, monkeypatch,
                       ["updates", "apply", "web", "--yes", "--json"])
        assert rc == EXIT_DENIED
        out = self._capped(capsys)
        assert out["status"] == "refused"
        assert any("no preview" in w for w in out["warnings"])

    def test_cli_apply_without_yes_refused(self, tmp_path, monkeypatch, capsys):
        compose_fixture(tmp_path)
        self._cli(tmp_path, monkeypatch, ["updates", "preview", "web", "--json"])
        capsys.readouterr()  # drain preview output
        rc = self._cli(tmp_path, monkeypatch, ["updates", "apply", "web", "--json"])
        assert rc == EXIT_DENIED
        out = self._capped(capsys)
        assert out["status"] == "refused"

    def test_cli_not_configured(self, tmp_path, monkeypatch, capsys):
        monkeypatch.delenv("PW_UPDATES_PROJECT_DIR", raising=False)
        rc = cli_main([
            "--data-dir", str(tmp_path / "data"),
            "--config-dir", str(tmp_path / "config"),
            "updates", "check", "--json",
        ])
        assert rc == EXIT_ERROR
        out = self._capped(capsys)
        assert out["status"] == "not_configured"

    def test_cli_status_read_only_never_mutates(self, tmp_path, monkeypatch, capsys):
        proj = compose_fixture(tmp_path)
        self._cli(tmp_path, monkeypatch, ["updates", "preview", "web", "--json"])
        rc = self._cli(tmp_path, monkeypatch, ["updates", "status", "--live", "--json"])
        assert rc == EXIT_OK
        assert yaml.safe_load((proj / "compose.yaml").read_text())[
            "services"]["web"]["image"] == "old:1.0"


# ---------------------------------------------------------------------------
# API surface
# ---------------------------------------------------------------------------


class TestApi:
    def test_api_updates_read_only_overview(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient

        from personal_world.api import create_app
        compose_fixture(tmp_path)
        monkeypatch.setenv("PW_API_TOKEN", "t")
        monkeypatch.setenv("PW_UPDATES_PROJECT_DIR", str(tmp_path / "proj"))
        c = TestClient(create_app(tmp_path, tmp_path / "config"))
        r = c.get("/api/updates", headers={"Authorization": "Bearer t"})
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["checks"]["web"]["available"] == "new:2.0"
        # read-only: compose file untouched
        assert yaml.safe_load((tmp_path / "proj" / "compose.yaml").read_text())[
            "services"]["web"]["image"] == "old:1.0"

    def test_api_updates_not_configured(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient

        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "t")
        monkeypatch.delenv("PW_UPDATES_PROJECT_DIR", raising=False)
        c = TestClient(create_app(tmp_path, tmp_path))
        r = c.get("/api/updates", headers={"Authorization": "Bearer t"})
        assert r.status_code == 200
        assert r.json()["status"] == "not_configured"

    def test_api_updates_requires_auth(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient

        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "t")
        monkeypatch.setenv("PW_UPDATES_PROJECT_DIR", str(tmp_path / "proj"))
        c = TestClient(create_app(tmp_path, tmp_path))
        assert c.get("/api/updates").status_code == 401