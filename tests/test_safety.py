import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.app import build_registry, load_world, save_world  # noqa: E402
from personal_world.cli import main as cli_main  # noqa: E402
from personal_world.model import (  # noqa: E402
    Fact,
    Policy,
    PolicyEffect,
    Provenance,
)
from personal_world.world import World  # noqa: E402


class TestReadSafety:
    """Read commands must never mutate state."""

    def test_status_does_not_write_world(self, tmp_path, capsys):
        w = World()
        w.record_fact(Fact(key="a", value=1, provenance=Provenance(source="t")))
        save_world(w, tmp_path / "world.json")
        before = (tmp_path / "world.json").read_text()

        rc = cli_main(["--data-dir", str(tmp_path), "status", "--json"])
        assert rc == 0
        assert (tmp_path / "world.json").read_text() == before

    def test_settings_export_does_not_write(self, tmp_path):
        rc = cli_main(["--data-dir", str(tmp_path),
                       "--config-dir", str(tmp_path),
                       "settings-export", "--json"])
        assert rc == 0
        assert not (tmp_path / "world.json").exists()


class TestDryRun:
    def test_daily_without_apply_writes_no_world(self, tmp_path, capsys):
        rc = cli_main(["--data-dir", str(tmp_path),
                       "--config-dir", str(tmp_path),
                       "daily", "--json"])
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        assert out["changed"] is False
        assert not (tmp_path / "world.json").exists()

    def test_daily_with_apply_persists(self, tmp_path, capsys):
        rc = cli_main(["--data-dir", str(tmp_path),
                       "--config-dir", str(tmp_path),
                       "daily", "--apply", "--json"])
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        assert out["changed"] is True
        assert (tmp_path / "world.json").exists()

    def test_backup_without_apply_writes_nothing(self, tmp_path, capsys):
        rc = cli_main(["--data-dir", str(tmp_path), "backup", "--json"])
        assert rc == 0
        assert not (tmp_path / "backup-payload.json").exists()


class TestPersistence:
    def test_world_survives_roundtrip(self, tmp_path):
        w = World()
        w.set_policy(Policy(
            key="content.animal_cruelty",
            effect=PolicyEffect.DENY,
            provenance=Provenance(source="user"),
        ))
        save_world(w, tmp_path / "world.json")
        w2 = load_world(tmp_path / "world.json")
        assert w2.policies["content.animal_cruelty"].effect == PolicyEffect.DENY

    def test_cement_survives_reload(self, tmp_path, capsys):
        cli_main(["--data-dir", str(tmp_path), "--config-dir", str(tmp_path),
                  "status", "--json"])  # ensure dir
        w = World()
        from personal_world.model import Mutability, Override
        w.set_policy(Policy(
            key="content.animal_cruelty",
            effect=PolicyEffect.DENY,
            override=Override.EXPLICIT_USER_REQUEST_ONLY,
            provenance=Provenance(source="user"),
        ))
        w.cement("content.animal_cruelty")
        save_world(w, tmp_path / "world.json")
        w2 = load_world(tmp_path / "world.json")
        assert w2.policies["content.animal_cruelty"].mutability == Mutability.CEMENTED


class TestApi:
    def _app(self, tmp_path, monkeypatch, token="secret-token-1"):
        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", token)
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        return create_app(tmp_path, tmp_path)

    def test_healthz_reports_auth_configured(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/healthz")
        assert r.status_code == 200
        assert r.json()["auth_configured"] is True

    def test_protected_route_rejects_anonymous(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        assert c.get("/api/status").status_code == 401

    def test_protected_route_rejects_wrong_token(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/api/status", headers={"Authorization": "Bearer nope"})
        assert r.status_code == 401

    def test_protected_route_accepts_correct_token(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/api/status", headers={"Authorization": "Bearer secret-token-1"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_fail_closed_when_no_token_configured(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        monkeypatch.delenv("PW_API_TOKEN", raising=False)
        from personal_world.api import create_app
        app = create_app(tmp_path, tmp_path)
        c = TestClient(app)
        assert c.get("/api/status").status_code == 503

    def test_api_and_cli_agree_on_state(self, tmp_path, monkeypatch, capsys):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        api_status = c.get("/api/status",
                           headers={"Authorization": "Bearer secret-token-1"}).json()
        cli_main(["--data-dir", str(tmp_path), "--config-dir", str(tmp_path),
                  "status", "--json"])
        cli_status = json.loads(capsys.readouterr().out)
        assert api_status["data"]["facts"] == cli_status["data"]["facts"]
        assert api_status["data"]["policies"] == cli_status["data"]["policies"]

    def test_settings_export_via_api_leaks_nothing(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/api/exports/settings",
                  headers={"Authorization": "Bearer secret-token-1"})
        blob = r.text
        for bad in ("burgeswe", "sk-live", "ghp_", "password"):
            assert bad not in blob, f"LEAK via API: {bad}"


class TestCoreBootsWithoutProviders:
    def test_empty_config_boots(self, tmp_path, capsys):
        rc = cli_main(["--data-dir", str(tmp_path),
                       "--config-dir", str(tmp_path),
                       "daily", "--json"])
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        assert out["ok"] is True

class TestIntegrationLeakage:
    """New V0.1 integrations must not leak auth or personal data
    through exports or the API surface."""

    def test_settings_export_has_no_auth_material(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/api/exports/settings",
                  headers={"Authorization": "Bearer secret-token-1"})
        blob = r.text
        for bad in ("secret-token-1", "Bearer", "Authorization",
                    "Remote-User", "Remote-Groups", "session"):
            assert bad not in blob, f"auth material in settings-export: {bad}"

    def test_backup_has_no_auth_material(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/api/backup",
                  headers={"Authorization": "Bearer secret-token-1"})
        assert "secret-token-1" not in r.text

    def test_candy_observation_minimal_fields(self, monkeypatch):
        import io
        import urllib.request
        from personal_world.providers.adapters import CandyDispenser
        fake_health = {
            "status": "ok", "notifications_sent": 3, "errors": 0,
            "grabs_accepted": 1, "grabs_refused": 2,
            "sources": ["mam_rss"], "seen_count": 100,
            "mam_indexer_name": "PrivateIndexer",
            "ebook_download_client_name": "PrivateClient",
            "phase_c": {"bandcamp_tag": "personal-tag"},
        }

        class _Resp(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake_urlopen(req, timeout=None):
            return _Resp(json.dumps(fake_health).encode())

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        candy = CandyDispenser("http://candy.test:5126")
        result = candy.observe()
        blob = json.dumps(result.data)
        for bad in ("PrivateIndexer", "PrivateClient", "personal-tag"):
            assert bad not in blob, f"candy observation leaked: {bad}"
        assert result.data["reachable"] is True
        assert result.data["notifications_sent"] == 3

    def test_forged_forwarded_identity_does_not_auth(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        app = self._app(tmp_path, monkeypatch)
        c = TestClient(app)
        r = c.get("/api/status",
                  headers={"Remote-User": "rylee", "Remote-Groups": "users",
                           "Authorization": "Bearer wrong"})
        assert r.status_code == 401

    def _app(self, tmp_path, monkeypatch):
        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "secret-token-1")
        return create_app(data_dir=tmp_path, config_dir=tmp_path)
