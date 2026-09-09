"""Principal resolution: the single identity seam.

Every protected route sees only a Principal (id, kind, owner_id,
scopes, auth_level, source). The trust root is local users
(Phase 1, Option B in the multi-user review 2026-09-09); OIDC is a
later authentication source that maps onto the same records. Perimeter
headers are never authorization, only possible login convenience.

Identity modes via PW_IDENTITY_MODE ("single" | "multi"):
- "single" (default): the legacy single-token gate continues to work.
  The principal is the instance bootstrap person, id "primary".
- "multi": tokens live in data/users.json (hashed); each token maps
  to exactly one local user (or agent principal).

The single-user install remains byte-identical after every phase.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

Kind = Literal["person", "agent", "service"]


@dataclass(frozen=True)
class Principal:
    """The identity that reached the handler. Scope model per issue #8."""
    id: str
    kind: Kind = "person"
    owner_id: str | None = None   # set when kind == "agent"
    display_name: str | None = None
    scopes: tuple[str, ...] = ()  # subset of owner scopes for agents
    auth_level: int = 1           # 1 bearer/session, 2 recent, 3 fresh-2fa
    source: str = "token"         # token | oidc | header | scheduler


def _token_fingerprint(token: str) -> str:
    """sha256 for high-entropy tokens; constant-time compare upstream."""
    return hashlib.sha256(token.encode()).hexdigest()


class NoPrincipalError(Exception):
    """Raised when no token / no matching hashed token is present."""


class IdentityStore:
    """Local users + per-user hashed token records.

    Storage shape (data root):
      users.json       — list of {user_id, display_name, hashed_tokens,
                          token_prefixes, enabled, created_at}
    Single-writer: the FastAPI process. Read-only for CLI helpers.
    """

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)
        self.path = self.data_dir / "users.json"

    # -- load/save ------------------------------------------------------
    def _load(self) -> dict:
        if self.path.exists():
            import json
            try:
                return json.loads(self.path.read_text())
            except Exception:
                pass
        return {"users": []}

    def _save(self, payload: dict) -> None:
        import json
        self.data_dir.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2))
        os.replace(tmp, self.path)

    # -- operations ------------------------------------------------------
    def create_user(self, user_id: str, display_name: str | None,
                    initial_plain_token: str | None = None) -> dict:
        payload = self._load()
        if any(u.get("user_id") == user_id for u in payload["users"]):
            raise ValueError(f"user exists: {user_id}")
        u = {"user_id": user_id, "display_name": display_name,
             "hashed_tokens": [], "token_prefixes": [],
             "enabled": True,
             "created_at": time.time()}
        if initial_plain_token:
            self._attach_token(u, initial_plain_token)
        payload["users"].append(u)
        self._save(payload)
        return u

    def attach_token(self, user_id: str, plain_token: str) -> None:
        payload = self._load()
        for u in payload["users"]:
            if u.get("user_id") == user_id:
                self._attach_token(u, plain_token)
                self._save(payload)
                return
        raise ValueError(f"no such user: {user_id}")

    def disable_user(self, user_id: str) -> None:
        payload = self._load()
        for u in payload["users"]:
            if u.get("user_id") == user_id:
                u["enabled"] = False
                self._save(payload)
                return
        raise ValueError(f"no such user: {user_id}")

    def list_users(self) -> list[dict]:
        return self._load().get("users", [])

    def _attach_token(self, user: dict, plain_token: str) -> None:
        user.setdefault("hashed_tokens", []).append(
            _token_fingerprint(plain_token))
        user.setdefault("token_prefixes", []).append(plain_token[:8])

    # -- resolution -------------------------------------------------------
    def match_token(self, token: str) -> dict | None:
        """Find the enabled user whose hashed token matches `token`."""
        fp = _token_fingerprint(token)
        payload = self._load()
        for u in payload.get("users", []):
            if not u.get("enabled", False):
                continue
            if any(hmac.compare_digest(fp, h) for h in u.get("hashed_tokens", [])):
                return u
        return None

    def legacy_primary(self, instance_token: str) -> dict:
        """The bootstrap person in single mode (id "primary")."""
        payload = self._load()
        users = payload.get("users", [])
        for u in users:
            if u.get("user_id") == "primary":
                return u
        u = self.create_user("primary", "Primary person",
                             initial_plain_token=instance_token)
        return self._load()["users"][0] if False else u


def resolve_principal(token: str | None,
                      store: IdentityStore | None,
                      mode: str,
                      instance_token: str | None) -> Principal:
    """The single seam. No handler ever sees the raw token."""
    if mode == "multi" and store is not None:
        found = store.match_token(token or "")
        if not found:
            raise NoPrincipalError("no principal for token")
        return Principal(id=found["user_id"], kind="person",
                         display_name=found.get("display_name"),
                         auth_level=1, source="token")
    # single mode: bootstrap "primary" directly from the instance token
    if not instance_token or not token or not hmac.compare_digest(
        token, instance_token):
        raise NoPrincipalError()
    return Principal(id="primary", kind="person",
                     display_name="Primary person", auth_level=1,
                     source="token")
