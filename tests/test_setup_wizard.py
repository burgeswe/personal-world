"""First-run setup wizard (low-cognition, accessibility contract).

The wizard serves a step-by-step HTML flow when setup is incomplete
and 302s to / when complete. Structure is the contract: lang, title,
steps, focusable controls at >= 44px targets, no color-only status.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.api import WIZARD_HTML  # noqa: E402


class TestWizardStructure:
    def test_language_is_english(self):
        assert 'lang="en"' in WIZARD_HTML

    def test_useful_title(self):
        assert "Setup wizard" in WIZARD_HTML

    def test_step_labels_present(self):
        assert "Step 1 of 5" in WIZARD_HTML
        for i in range(2, 6):
            assert f'data-step="{i}"' in WIZARD_HTML

    def test_companion_choices_are_all_served(self):
        for c in ("personal-world", "mermaid", "robot",
                  "world-tree-squirrel", "taco-news-truck"):
            assert f'data-c="{c}"' in WIZARD_HTML

    def test_min_touch_targets(self):
        # buttons and inputs must keep >= 44px min-height (a11y floor)
        assert "min-height: 48px" in WIZARD_HTML
        assert "min-height: 56px" in WIZARD_HTML
        assert "min-height: 44px" in WIZARD_HTML

    def test_color_scheme_dark(self):
        assert "color-scheme: dark" in WIZARD_HTML

    def test_generate_button_offers_strong_token(self):
        assert "crypto.getRandomValues" in WIZARD_HTML

    def test_finish_posts_world_name_fact(self):
        # canonical fact key world.name persisted by the wizard
        assert "world.name" in WIZARD_HTML

    def test_finish_persists_token_to_localstorage(self):
        assert 'localStorage.setItem("pw-token"' in WIZARD_HTML


class TestWizardRoute:
    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "t")
        return TestClient(create_app(tmp_path, tmp_path)), tmp_path

    def test_wizard_serves_when_setup_needed(self, client):
        c, _ = client
        r = c.get("/setup-wizard")
        assert r.status_code == 200
        assert "Step 1 of 5" in r.text

    def test_wizard_redirects_when_setup_complete(self, client):
        c, tmp = client
        (tmp / "setup-complete").write_text("ok")
        r = c.get("/setup-wizard", follow_redirects=False)
        assert r.status_code == 302
        assert r.headers["location"] == "/"
