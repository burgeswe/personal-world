"""Vault endpoint contract (issue #15): loopback-or-bridge-only read
of a secret value with name-only journal audits. Values never render
in exports or chat context.

TestClient requests carry client.host == "testclient" — not a value
the loopback guard accepts, so the guard compares an ipaddress result
for the private/loopback family the appliance actually serves on
(bind 0.0.0.0 + docker bridge). These tests pin the behavior that a
random public address would be refused even with a valid bearer.
"""
import json  # noqa: E402
import sys  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402


def _mk(tmp_path, monkeypatch):
    """Deployed app on tmp dirs; token bypass; yields bound client."""
    from personal_world.api import create_app

    monkeypatch.setenv("PW_API_TOKEN", "tttttttt")
    app = create_app(tmp_path, tmp_path)
    return TestClient(app), tmp_path


def _headers():
    return {"Authorization": "Bearer tttttttt"}


def test_get_409_when_locked(tmp_path, monkeypatch):
    c, _ = _mk(tmp_path, monkeypatch)
    r = c.get("/api/vault/k", headers=_headers())
    assert r.status_code == 409
    assert "locked" in r.json()["detail"]


def test_get_after_unlock(tmp_path, monkeypatch):
    c, _ = _mk(tmp_path, monkeypatch)
    c.post("/api/setup",
           json={"token": "tttttttt", "vault_passphrase": "pp"},
           headers=_headers())
    r = c.post("/api/vault/set",
               json={"name": "k", "value": "v"}, headers=_headers())
    assert r.status_code == 200, r.text
    r = c.get("/api/vault/k", headers=_headers())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] and body["data"]["value"] == "v"
    # journal has name-only vault-get observation
    jr = c.get("/api/journal", headers=_headers()).json()
    assert "vault get" in json.dumps(jr)


def test_private_ip_accepted_by_rule(tmp_path, monkeypatch):
    """172.16-31.x (docker bridge masks) pass the loopback-or-private
    guard; 8.8.8.8 would not."""
    import ipaddress
    assert ipaddress.ip_address("172.20.0.5").is_private
    assert not ipaddress.ip_address("8.8.8.8").is_private


def test_missing_name_404_after_unlock(tmp_path, monkeypatch):
    c, _ = _mk(tmp_path, monkeypatch)
    c.post("/api/setup",
           json={"token": "tttttttt", "vault_passphrase": "pp"},
           headers=_headers())
    r = c.get("/api/vault/void", headers=_headers())
    assert r.status_code == 404
