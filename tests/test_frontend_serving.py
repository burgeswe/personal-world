"""P1 T3: frontend serving boundary (PW_FRONTEND / PW_FRONTEND_DIST).

Proves the legacy default is untouched, react mode serves the SPA
honestly (with an honest 503 when dist is missing), API/static routes
keep winning by registration order, traversal cannot escape dist, and
no private value is echoed into any served HTML.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

TOKEN = "instancetoken-do-not-leak-7f3a"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

INDEX_HTML = (
    "<!doctype html><html><head><title>Personal World</title></head>"
    '<body><div id="root" data-marker="fake-dist"></div></body></html>'
)


@pytest.fixture
def fake_dist(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX_HTML)
    (dist / "assets" / "app-abc123.js").write_text('console.log("app")')
    (dist / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
    return dist


def _app(tmp_path, monkeypatch, dist=None):
    from personal_world.api import create_app
    from personal_world.init import init_world

    monkeypatch.setenv("PW_API_TOKEN", TOKEN)
    monkeypatch.setenv("PW_IDENTITY_MODE", "single")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    if dist is not None:
        monkeypatch.setenv("PW_FRONTEND_DIST", str(dist))
    init_world(tmp_path, tmp_path)
    (tmp_path / "setup-complete").write_text("ok")
    app = create_app(tmp_path, tmp_path)
    return TestClient(app), app


def _legacy(tmp_path, monkeypatch):
    return _app(tmp_path, monkeypatch)


def _react(tmp_path, monkeypatch, dist):
    monkeypatch.setenv("PW_FRONTEND", "react")
    return _app(tmp_path, monkeypatch, dist=dist)


class TestLegacyDefault:
    def test_env_unset_defaults_to_legacy(self, tmp_path, monkeypatch):
        monkeypatch.delenv("PW_FRONTEND", raising=False)
        client, app = _legacy(tmp_path, monkeypatch)
        assert app.state.frontend_mode == "legacy"
        assert "frontend" in str(app.state.frontend_dist)

    def test_no_catch_all_route_registered(self, tmp_path, monkeypatch):
        monkeypatch.delenv("PW_FRONTEND", raising=False)
        client, app = _legacy(tmp_path, monkeypatch)
        paths = [r.path for r in app.routes]
        assert "/{full_path:path}" not in paths

    def test_root_is_legacy_dashboard(self, tmp_path, monkeypatch):
        monkeypatch.delenv("PW_FRONTEND", raising=False)
        client, _ = _legacy(tmp_path, monkeypatch)
        r = client.get("/")
        assert r.status_code == 200
        assert "Personal World — Today" in r.text

    def test_unknown_page_is_404(self, tmp_path, monkeypatch):
        monkeypatch.delenv("PW_FRONTEND", raising=False)
        client, _ = _legacy(tmp_path, monkeypatch)
        r = client.get("/no/such/page")
        assert r.status_code == 404


class TestReactMode:
    def test_serves_index_with_no_cache(self, tmp_path, monkeypatch, fake_dist):
        client, app = _react(tmp_path, monkeypatch, fake_dist)
        assert app.state.frontend_mode == "react"
        r = client.get("/")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text
        assert r.headers["Cache-Control"] == "no-cache"

    def test_spa_fallback_serves_index(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/projects/vefr/anything")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text

    def test_legacy_pages_return_index(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        for path in ("/setup", "/setup-wizard", "/login"):
            r = client.get(path)
            assert r.status_code == 200, path
            assert 'data-marker="fake-dist"' in r.text, path
            assert r.headers["content-type"].startswith("text/html")

    def test_assets_get_immutable_cache(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/assets/app-abc123.js")
        assert r.status_code == 200
        assert r.text == 'console.log("app")'
        assert "immutable" in r.headers["Cache-Control"]

    def test_favicon_served(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/favicon.svg")
        assert r.status_code == 200


class TestApiRoutesNeverSwallowed:
    def test_unknown_api_route_is_json_404(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api/definitely-not-a-route")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/json")
        assert "not found" in r.json()["detail"]

    def test_api_status_still_works(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api/status", headers=AUTH)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_healthz_still_works(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_unauthenticated_api_gets_401_not_index(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api/sections")
        assert r.status_code == 401
        assert 'data-marker="fake-dist"' not in r.text

    def test_bare_api_path_is_404(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/json")


class TestStaticRoutesStillWin:
    def test_companion_svg(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/companions/personal-world.svg")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/svg+xml"

    def test_icon_sprite(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/icons/sprite.svg")
        assert r.status_code == 200


class TestTraversal:
    def test_dotdot_path_cannot_escape_dist(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        secret = tmp_path / "secret.txt"
        secret.write_text("TOP SECRET")
        for path in ("/../secret.txt", "/%2e%2e/secret.txt"):
            r = client.get(path)
            assert r.status_code in (200, 404), path
            assert "TOP SECRET" not in (r.text or "")

    def test_index_404_index_page(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        assert client.get("/").status_code == 200


class TestNoSecretsInHtml:
    def test_index_has_no_token_or_bearer(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/")
        assert TOKEN not in r.text
        assert "Bearer" not in r.text

    def test_503_page_has_no_token_or_bearer(self, tmp_path, monkeypatch):
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        client, _ = _react(tmp_path, monkeypatch, empty)
        r = client.get("/")
        assert TOKEN not in r.text
        assert "Bearer" not in r.text


class TestMissingDist:
    def test_honest_503_without_api_disruption(self, tmp_path, monkeypatch):
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        monkeypatch.setenv("PW_FRONTEND", "react")
        client, _ = _app(tmp_path, monkeypatch, dist=empty)
        r = client.get("/")
        assert r.status_code == 503
        assert r.headers["content-type"].startswith("text/html")
        assert "interface is not built" in r.text
        assert str(empty) not in r.text
        # API untouched by the missing dist
        assert client.get("/api/status", headers=AUTH).status_code == 200
        assert client.get("/healthz").status_code == 200

    def test_503_page_exact_heading(self, tmp_path, monkeypatch):
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        monkeypatch.setenv("PW_FRONTEND", "react")
        client, _ = _app(tmp_path, monkeypatch, dist=empty)
        r = client.get("/")
        assert "<h1>Personal World's interface is not built</h1>" in r.text


class TestInvalidMode:
    def test_invalid_value_treated_as_legacy(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_FRONTEND", "banana")
        client, app = _app(tmp_path, monkeypatch)
        assert app.state.frontend_mode == "legacy"
        paths = [r.path for r in app.routes]
        assert "/{full_path:path}" not in paths
        r = client.get("/")
        assert r.status_code == 200
        assert "Personal World — Today" in r.text