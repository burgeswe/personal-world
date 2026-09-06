"""Safe updates: check -> preview -> apply -> verify -> (rollback) -> record.

The user-facing concept: "Update available -> Here's what will change ->
Apply -> Verify -> Go back if needed." Deliberately NOT container
orchestration and NOT a deployment platform: the core owns one small
state machine plus the safety rules around it; a provider executes only
the primitive operations on a named target.

Safety contract (enforced here, never by provider goodwill):

- ``check`` and ``preview`` are strictly read-only.
- ``apply`` requires an explicit ``confirm=True`` AND a preview
  generated in the same session context (in-process, or the persisted
  session file for CLI invocations). A stale preview (the target
  drifted since preview) is refused. Refusals are journaled.
- Before apply, the provider's known-good state is captured and
  journaled. ``verify`` runs after apply. A failed verify triggers an
  automatic rollback attempt; a failed rollback raises a loud
  structured error -- success is never declared silently.
- Every step, including refusals and failures, is journaled (the one
  existing journal; no second event stream).

Reference provider: :class:`ComposeUpdateProvider` (``mode=native``)
wraps ``docker compose`` on ONE local project directory; its "update"
is rewriting a service's image tag, verified through ``docker compose
config`` when docker is installed and by parsing the file when not.
Swap in any other :class:`UpdateProvider` -- the state machine is
provider-neutral (the same test suite must pass for two different
providers; see tests/test_updates.py).
"""

import hashlib
import json
import os
import shutil
import subprocess
from abc import ABC, abstractmethod
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from .journal import Journal
from .model import JournalEvent, JournalKind


class UpdateCheck(BaseModel):
    """Read-only answer: is an update available for this target?"""

    target: str
    current: str
    available: str | None = None
    provider: str


class UpdatePreview(BaseModel):
    """Read-only plan of exactly what an apply would change."""

    target: str
    steps: list[str] = Field(default_factory=list)
    mutations: list[str] = Field(default_factory=list)
    reversible: bool = True
    risk_notes: list[str] = Field(default_factory=list)


class UpdateResult(BaseModel):
    """Outcome of apply / rollback. ``error`` carries the story when
    verify failed (even if rollback then succeeded)."""

    applied: bool = False
    verified: bool = False
    rolled_back: bool = False
    error: str | None = None
    journal_ref: str | None = None


class UpdateRefused(Exception):
    """The safety contract refused this step (no confirm, no preview,
    stale preview, nothing to apply)."""


class UpdateRollbackFailed(Exception):
    """Verify failed AND the automatic rollback also failed. Loud by
    design; the target is left updated-but-unverified and the journal
    records the failure."""


class UpdateProvider(ABC):
    """Provider-neutral contract for the ``updates`` capability.

    The core owns the state machine; implementers only execute the
    primitives. check/preview MUST be read-only."""

    name: str

    @abstractmethod
    def targets(self) -> list[str]:
        """Target names this provider can update."""

    @abstractmethod
    def check(self, target: str) -> UpdateCheck:
        """Read-only: current vs available."""

    @abstractmethod
    def preview(self, target: str) -> UpdatePreview:
        """Read-only: exactly what apply would change."""

    @abstractmethod
    def known_good(self, target: str) -> dict:
        """Snapshot for rollback. Must include ``state`` (small,
        human-readable known-good record for the journal) and ``hash``
        (equality token for staleness checks). Provider-specific
        restore payloads (e.g. file bytes) ride along."""

    @abstractmethod
    def apply(self, target: str, preview: UpdatePreview) -> dict:
        """Perform the mutation previewed. Raises on failure."""

    @abstractmethod
    def verify(self, target: str) -> bool:
        """Health check after apply."""

    @abstractmethod
    def rollback(self, target: str, known_good: dict) -> dict:
        """Restore the known-good state. Raises on failure."""


class UpdateManager:
    """The core-owned state machine: check -> preview -> apply ->
    verify -> (rollback) -> record. Every step writes to the journal.

    ``session_path`` persists previews and known-good snapshots across
    process invocations (the CLI context); ``None`` keeps the session
    in-memory (library/test use)."""

    def __init__(
        self,
        provider: UpdateProvider,
        journal: Journal,
        session_path: Path | None = None,
    ) -> None:
        self.provider = provider
        self.journal = journal
        self.session_path = Path(session_path) if session_path else None
        self._previews: dict[str, dict] = {}
        self._known_good: dict[str, dict] = {}
        self._last: dict[str, dict] = {}
        self._load_session()

    # -- journal ----------------------------------------------------------
    def _j(self, kind: JournalKind, summary: str) -> JournalEvent:
        return self.journal.record(kind, summary, source=f"updates/{self.provider.name}")

    def _count(self) -> int:
        return sum(1 for _ in self.journal.events())

    # -- session persistence ----------------------------------------------
    def _load_session(self) -> None:
        if self.session_path is None or not self.session_path.exists():
            return
        try:
            payload = json.loads(self.session_path.read_text())
        except Exception:
            return
        if payload.get("provider") != self.provider.name:
            return
        self._previews = payload.get("previews", {})
        self._known_good = payload.get("known_good", {})
        self._last = payload.get("last", {})

    def _save_session(self) -> None:
        if self.session_path is None:
            return
        payload = {
            "provider": self.provider.name,
            "previews": self._previews,
            "known_good": self._known_good,
            "last": self._last,
        }
        self.session_path.parent.mkdir(parents=True, exist_ok=True)
        self.session_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True, default=str)
        )

    # -- state machine -----------------------------------------------------
    def check(self, target: str | None = None) -> UpdateCheck | dict[str, UpdateCheck]:
        """Read-only. ``None`` checks every target the provider knows."""
        if target is None:
            checks = {t: self.provider.check(t) for t in self.provider.targets()}
            summary = json.dumps(
                {t: {"current": c.current, "available": c.available}
                 for t, c in checks.items()},
                sort_keys=True,
            )
            self._j(JournalKind.OBSERVATION, f"check all targets: {summary}")
            return checks
        c = self.provider.check(target)
        self._j(
            JournalKind.OBSERVATION,
            f"check target={target} current={c.current!r} "
            f"available={c.available!r} provider={c.provider}",
        )
        return c

    def preview(self, target: str) -> UpdatePreview:
        """Read-only plan; stored in the session so a later apply can
        prove it was previewed (and hasn't gone stale)."""
        p = self.provider.preview(target)
        kg = self.provider.known_good(target)
        self._previews[target] = {"preview": p.model_dump(), "hash": kg["hash"]}
        self._save_session()
        self._j(
            JournalKind.RECOMMENDATION,
            f"preview target={target} mutations={p.mutations} "
            f"reversible={p.reversible}",
        )
        return p

    def apply(self, target: str, confirm: bool = False) -> UpdateResult:
        """Apply the previewed update. Requires ``confirm=True`` and a
        live preview in this session. Verify failure triggers an
        automatic rollback; rollback failure raises loudly."""
        start = self._count()

        def ref() -> str:
            return f"entries[{start}:{self._count()}]"

        if not confirm:
            self._j(
                JournalKind.SECURITY,
                f"apply target={target} refused: no explicit confirmation",
            )
            raise UpdateRefused(
                f"apply of '{target}' requires explicit confirmation "
                "(confirm=True / CLI --yes)"
            )
        stored = self._previews.get(target)
        if stored is None:
            self._j(
                JournalKind.SECURITY,
                f"apply target={target} refused: no preview in this session",
            )
            raise UpdateRefused(
                f"no preview for '{target}' in this session; run check + "
                "preview first -- apply without preview is refused"
            )
        live = self.provider.known_good(target)
        if live["hash"] != stored["hash"]:
            self._previews.pop(target, None)
            self._save_session()
            self._j(
                JournalKind.SECURITY,
                f"apply target={target} refused: preview stale "
                "(target drifted since preview)",
            )
            raise UpdateRefused(
                f"preview for '{target}' is stale; re-run preview"
            )
        preview = UpdatePreview.model_validate(stored["preview"])
        if not preview.mutations:
            raise UpdateRefused(
                f"nothing to apply for '{target}' (preview lists no mutations)"
            )
        self._j(
            JournalKind.APPROVAL,
            f"apply target={target} approved; mutations={preview.mutations}",
        )
        self._known_good[target] = live
        self._save_session()
        self._j(
            JournalKind.PROVIDER_ACTION,
            f"known-good recorded for target={target}: state={live['state']}",
        )
        try:
            out = self.provider.apply(target, preview)
        except Exception as e:
            self._j(JournalKind.FAILURE, f"apply target={target} failed: {e}")
            raise
        self._j(JournalKind.PROVIDER_ACTION, f"applied target={target}: {out}")
        verified = self.provider.verify(target)
        self._j(
            JournalKind.HEALTH,
            f"verify target={target} after apply: "
            f"{'ok' if verified else 'FAILED'}",
        )
        result = UpdateResult(applied=True, verified=verified)
        if verified:
            self._j(
                JournalKind.PROVIDER_ACTION,
                f"update complete target={target} (verified)",
            )
        else:
            result.error = "verify failed after apply; attempting automatic rollback"
            self._j(
                JournalKind.FAILURE,
                f"verify failed target={target}; automatic rollback starting",
            )
            try:
                rb = self.provider.rollback(target, live)
            except Exception as e:
                self._j(
                    JournalKind.FAILURE,
                    f"ROLLBACK FAILED target={target}: {e}; target left in "
                    "updated-but-unverified state -- manual intervention needed",
                )
                self._previews.pop(target, None)
                result.journal_ref = ref()
                result.error = f"verify failed and rollback failed: {e}"
                self._last[target] = result.model_dump()
                self._save_session()
                raise UpdateRollbackFailed(
                    f"verify failed for '{target}' and automatic rollback "
                    f"failed too: {e}"
                ) from e
            result.rolled_back = True
            result.error = (
                f"verify failed after apply; rolled back to known-good ({rb})"
            )
            self._j(
                JournalKind.RECONCILIATION,
                f"automatic rollback ok target={target}: {rb}",
            )
        self._previews.pop(target, None)
        result.journal_ref = ref()
        self._last[target] = result.model_dump()
        self._save_session()
        return result

    def rollback(self, target: str) -> UpdateResult:
        """Manual rollback to the journaled known-good state."""
        start = self._count()
        kg = self._known_good.get(target)
        if kg is None:
            self._j(
                JournalKind.SECURITY,
                f"rollback target={target} refused: no known-good state recorded",
            )
            raise UpdateRefused(
                f"no known-good state recorded for '{target}'; nothing to roll back"
            )
        rb = self.provider.rollback(target, kg)
        self._j(
            JournalKind.RECONCILIATION,
            f"manual rollback target={target}: {rb}",
        )
        result = UpdateResult(rolled_back=True)
        result.journal_ref = f"entries[{start}:{self._count()}]"
        self._previews.pop(target, None)
        self._known_good.pop(target, None)
        self._last[target] = result.model_dump()
        self._save_session()
        return result

    def status(self, live: bool = False) -> dict:
        """Session state per target; ``live=True`` adds a read-only
        check per target (never mutates)."""
        out: dict = {
            "provider": self.provider.name,
            "targets": {},
        }
        for t in self.provider.targets():
            entry: dict = {
                "has_preview": t in self._previews,
                "known_good_recorded": t in self._known_good,
                "last": self._last.get(t),
            }
            if live:
                c = self.provider.check(t)
                entry["current"] = c.current
                entry["available"] = c.available
            out["targets"][t] = entry
        return out


class FakeUpdateProvider(UpdateProvider):
    """Deterministic in-memory reference fake (tests and CLI
    ``--provider fake``). No external system, no docker."""

    name = "fake"

    def __init__(
        self,
        state: dict[str, dict] | None = None,
        desired: dict[str, str] | None = None,
    ) -> None:
        self.state = state or {"web": {"image": "app:1.0"}}
        self.desired = desired or {"web": "app:1.1"}
        self.fail_verify = False
        self.fail_rollback = False
        self.mutations_applied: list[str] = []

    def targets(self) -> list[str]:
        return sorted(self.state)

    def check(self, target: str) -> UpdateCheck:
        cur = self.state[target]["image"]
        want = self.desired.get(target)
        return UpdateCheck(
            target=target,
            current=cur,
            available=want if want and want != cur else None,
            provider=self.name,
        )

    def preview(self, target: str) -> UpdatePreview:
        c = self.check(target)
        if c.available is None:
            return UpdatePreview(
                target=target,
                steps=["no changes: already at desired version"],
                mutations=[],
                reversible=True,
                risk_notes=[],
            )
        return UpdatePreview(
            target=target,
            steps=[
                f"set {target} image {c.current} -> {c.available}",
                "verify the new image serves traffic",
            ],
            mutations=[f"{target}.image: {c.current} -> {c.available}"],
            reversible=True,
            risk_notes=["fake fixture; real targets should review image provenance"],
        )

    def known_good(self, target: str) -> dict:
        snap = json.dumps(self.state[target], sort_keys=True)
        return {
            "state": dict(self.state[target]),
            "hash": hashlib.sha256(snap.encode()).hexdigest(),
        }

    def apply(self, target: str, preview: UpdatePreview) -> dict:
        new = self.desired[target]
        self.state[target]["image"] = new
        self.mutations_applied.append(f"{target}.image -> {new}")
        return {"changed": True, "image": new}

    def verify(self, target: str) -> bool:
        return (
            self.state[target]["image"] == self.desired[target]
            and not self.fail_verify
        )

    def rollback(self, target: str, known_good: dict) -> dict:
        if self.fail_rollback:
            raise RuntimeError("simulated rollback failure")
        self.state[target] = dict(known_good["state"])
        self.mutations_applied.append(f"{target} restored to known-good")
        return {"restored": True, "state": known_good["state"]}

    def snapshot(self) -> dict:
        return json.loads(json.dumps(self.state))


class ComposeUpdateProvider(UpdateProvider):
    """Reference implementation (``mode=native``): wraps ``docker
    compose`` on ONE local project directory. The "update" is rewriting
    a service's image tag in the compose file; verify runs ``docker
    compose config`` when the docker client is installed (client-side,
    no daemon needed) and falls back to parsing the file when not.
    Replace this class for any other update source."""

    name = "compose-native"

    COMPOSE_NAMES = (
        "compose.yaml",
        "compose.yml",
        "docker-compose.yaml",
        "docker-compose.yml",
    )

    def __init__(
        self,
        project_dir: Path | str,
        desired: dict[str, str] | None = None,
        docker_bin: str | None = None,
    ) -> None:
        self.dir = Path(project_dir)
        self.compose_file = next(
            (self.dir / n for n in self.COMPOSE_NAMES if (self.dir / n).exists()),
            None,
        )
        self.desired = dict(desired or {})
        self.docker_bin = docker_bin if docker_bin is not None else shutil.which("docker")

    def targets(self) -> list[str]:
        if self.compose_file is None:
            return []
        data = yaml.safe_load(self.compose_file.read_text()) or {}
        services = data.get("services") or {}
        return sorted(set(services) & set(self.desired))

    def _service(self, target: str) -> dict:
        data = yaml.safe_load(self.compose_file.read_text()) or {}
        return (data.get("services") or {})[target]

    def check(self, target: str) -> UpdateCheck:
        if self.compose_file is None:
            return UpdateCheck(target=target, current="", available=None, provider=self.name)
        cur = self._service(target).get("image") or ""
        want = self.desired.get(target)
        return UpdateCheck(
            target=target,
            current=cur,
            available=want if want and want != cur else None,
            provider=self.name,
        )

    def preview(self, target: str) -> UpdatePreview:
        c = self.check(target)
        if c.available is None:
            return UpdatePreview(
                target=target,
                steps=["no changes: already at desired version"],
                mutations=[],
                reversible=True,
                risk_notes=[],
            )
        rel = self.compose_file.name
        return UpdatePreview(
            target=target,
            steps=[
                f"rewrite {rel}: services.{target}.image = {c.available}",
                "validate the rewritten file (docker compose config)",
                "converge the running project (docker compose up -d) -- "
                "left to the operator",
            ],
            mutations=[f"{rel}: services.{target}.image {c.current} -> {c.available}"],
            reversible=True,
            risk_notes=[
                "rewrites the compose file in place; known-good bytes are "
                "journaled before apply",
                "verify is config-level (`docker compose config`), not a "
                "runtime probe",
            ],
        )

    def known_good(self, target: str) -> dict:
        text = self.compose_file.read_text()
        return {
            "state": {"image": self._service(target).get("image")},
            "hash": hashlib.sha256(text.encode()).hexdigest(),
            "content": text,
            "file": str(self.compose_file),
        }

    def apply(self, target: str, preview: UpdatePreview) -> dict:
        data = yaml.safe_load(self.compose_file.read_text()) or {}
        new = self.desired[target]
        data["services"][target]["image"] = new
        self.compose_file.write_text(yaml.safe_dump(data, sort_keys=False))
        return {"changed": True, "image": new, "file": str(self.compose_file)}

    def verify(self, target: str) -> bool:
        want = self.desired[target]
        if self.docker_bin:
            try:
                proc = subprocess.run(
                    [self.docker_bin, "compose", "-f", str(self.compose_file),
                     "config", "--format", "json"],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
            except Exception:
                return False
            if proc.returncode != 0:
                return False
            try:
                effective = (json.loads(proc.stdout).get("services") or {})
                return effective.get(target, {}).get("image") == want
            except Exception:
                return False
        data = yaml.safe_load(self.compose_file.read_text()) or {}
        return (data.get("services") or {}).get(target, {}).get("image") == want

    def rollback(self, target: str, known_good: dict) -> dict:
        Path(known_good["file"]).write_text(known_good["content"])
        return {"restored": True, "file": known_good["file"]}


def build_provider(
    config_dir: Path | str | None = None,
    provider: str = "compose",
    project_dir: Path | str | None = None,
) -> UpdateProvider | None:
    """Wire a provider by kind. ``compose`` needs a project directory
    (argument or ``$PW_UPDATES_PROJECT_DIR``) and, optionally, a
    ``config/updates-desired.json`` mapping of ``{target: desired_image}``;
    without a directory there is nothing to update and ``None`` is
    returned (the caller reports not_configured)."""
    if provider == "fake":
        return FakeUpdateProvider()
    raw = project_dir if project_dir is not None else os.environ.get(
        "PW_UPDATES_PROJECT_DIR", ""
    ) or ""
    if not str(raw).strip():
        return None
    pdir = Path(raw)
    desired: dict[str, str] = {}
    if config_dir is not None:
        dp = Path(config_dir) / "updates-desired.json"
        if dp.exists():
            desired = json.loads(dp.read_text())
    return ComposeUpdateProvider(pdir, desired)