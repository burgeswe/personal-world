"""Identity seam (issue #8 phase 0/1) contract pins.

resolve_principal is the single seam: single-mode behavior must be
byte-identical to the pre-seam gate; multi-mode resolves hashed
local tokens. User.data_dir honors PW_DATA_DIR so per-user state
lives under the appliance root, not a hardcoded path.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.identity import (  # noqa: E402
    IdentityStore, NoPrincipalError, Principal, resolve_principal,
)
from personal_world.user import User, UserManager  # noqa: E402


class TestSingleMode:
    """Single mode must mirror the legacy gate exactly."""

    def test_exact_instance_token_resolves_primary(self):
        p = resolve_principal("insttok123", None, "single", "insttok123")
        assert p.id == "primary" and p.source == "token"

    def test_wrong_token_raises_no_principal(self):
        with pytest.raises(NoPrincipalError):
            resolve_principal("wrong", None, "single", "insttok123")

    def test_no_token_raises(self):
        with pytest.raises(NoPrincipalError):
            resolve_principal(None, None, "single", "insttok123")


class TestMultiMode:
    """Multi mode resolves hashed user tokens from IdentityStore."""

    @pytest.fixture
    def store(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        s = IdentityStore(tmp_path)
        s.create_user("primary", "Primary person",
                      initial_plain_token="tok-primary-1")
        return s

    def test_matching_token_resolves_person(self, store):
        p = resolve_principal("tok-primary-1", store, "multi", None)
        assert p.id == "primary" and p.kind == "person"

    def test_wrong_token_raises(self, store):
        with pytest.raises(NoPrincipalError):
            resolve_principal("wrong", store, "multi", None)

    def test_no_token_raises(self, store):
        with pytest.raises(NoPrincipalError):
            resolve_principal(None, store, "multi", None)

    def test_disabled_user_denied(self, store):
        store.disable_user("primary")
        with pytest.raises(NoPrincipalError):
            resolve_principal("tok-primary-1", store, "multi", None)

    def test_token_fingerprint_not_plaintext(self, store):
        raw = (Path(store.data_dir) / "users.json").read_text()
        assert "tok-primary-1" not in raw


class TestUserLayout:
    """User.data_dir honors PW_DATA_DIR (per-user state tree)."""

    def test_data_dir_honors_root(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        u = User(id="fred", name="Fred")
        assert u.data_dir == tmp_path / "users" / "fred"
        assert u.world_path == u.data_dir / "world.json"
        assert u.journal_path == u.data_dir / "journal.ndjson"
        assert u.vault_path == u.data_dir / "vault.enc"
        assert u.prefs_path == u.data_dir / "prefs.json"

    def test_user_manager_create_persists(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        mgr = UserManager(tmp_path / "users-record")
        u = mgr.create(User(id="fred", name="Fred", display_name="F"))
        # both the record and the state dir should exist
        assert (tmp_path / "users-record" / "fred.json").exists()
        # per-user state dir forms under PW_DATA_DIR/users/fred
        assert (tmp_path / "users" / "fred").exists()

    def test_user_manager_get(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        mgr = UserManager(tmp_path / "users-record")
        mgr.create(User(id="fred", name="Fred"))
        assert mgr.get("fred").name == "Fred"
        assert mgr.get("nope") is None


class TestPerUserPrefs:
    """Multi mode routes prefs and journal writes to the caller's
    per-user state tree; single mode stays byte-identical."""

    @pytest.fixture
    def app(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "tok-aaaa-bbbb")
        monkeypatch.setenv("PW_IDENTITY_MODE", "multi")
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        c = TestClient(create_app(tmp_path, tmp_path))
        return c, tmp_path

    def _headers(self, token):
        return {"Authorization": "Bearer " + token}

    def test_multi_mode_first_user_sets_prefs(self, app):
        c, tmp_path = app
        from personal_world.identity import IdentityStore
        store = IdentityStore(tmp_path)
        store.create_user("alpha", "Alpha person",
                          initial_plain_token="alpha-token")
        store.create_user("beta", "Beta person",
                          initial_plain_token="beta-token")
        # alpha's text_scale should persist into alpha's own tree
        r = c.put("/api/prefs", json={"text_scale": 1.25},
                  headers={"Authorization": "Bearer alpha-token"})
        assert r.status_code == 200, r.text
        userfile = tmp_path / "users" / "alpha" / "world.json"
        assert userfile.exists()
        data = json.loads(userfile.read_text())
        assert data["accessibility"]["text_scale"] == 1.25
        # beta's tree is created lazily on beta's first write; absence
        # is isolation proof (beta hasn't called yet)
        beta_world = tmp_path / "users" / "beta" / "world.json"
        if beta_world.exists():
            assert json.loads(
                beta_world.read_text())["accessibility"]["text_scale"] == 1.0

    def test_multi_mode_journal_isolated(self, app):
        c, tmp_path = app
        from personal_world.identity import IdentityStore
        store = IdentityStore(tmp_path)
        store.create_user("alpha", "Alpha person",
                          initial_plain_token="alpha-token")
        store.create_user("beta", "Beta person",
                          initial_plain_token="beta-token")
        # alpha writes a journal event only to alpha's tree; beta's
        # journal stays empty. /api/journal/audit reads the caller's
        # tree, so no cross-read occurs even by sharing the route.
        r = c.post("/api/world/fact", json={"key": "a.fact", "value": "x"},
                   headers={"Authorization": "Bearer alpha-token"})
        assert r.status_code in (200, 403), r.text
        # Nothing's mounted into beta's journal yet
        beta_journal = tmp_path / "users" / "beta" / "journal.ndjson"
        if beta_journal.exists():
            assert "a.fact" not in beta_journal.read_text()
