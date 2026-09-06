import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.api import DASHBOARD_HTML  # noqa: E402


class TestDashboardStructure:
    """The dashboard shell must expose real structure to Figma and
    assistive tech, with semantics before decoration."""

    def test_language_is_english(self):
        assert 'lang="en"' in DASHBOARD_HTML

    def test_useful_page_title(self):
        assert "<title>Personal World — Today</title>" in DASHBOARD_HTML

    def test_skip_to_content_link_is_first_focusable(self):
        # The skip link must come before any other interactive element
        skip_pos = DASHBOARD_HTML.find('class="skip"')
        input_pos = DASHBOARD_HTML.find('<input')
        button_pos = DASHBOARD_HTML.find('<button')
        nav_pos = DASHBOARD_HTML.find("<nav")
        assert skip_pos > 0
        assert skip_pos < input_pos
        assert skip_pos < button_pos
        assert skip_pos < nav_pos

    def test_status_region_for_live_updates(self):
        assert 'id="msg"' in DASHBOARD_HTML
        assert 'role="status"' in DASHBOARD_HTML
        assert 'aria-live="polite"' in DASHBOARD_HTML

    def test_main_landmark_present(self):
        assert "<main" in DASHBOARD_HTML

    def test_nav_with_aria_label(self):
        assert '<nav aria-label="Main"' in DASHBOARD_HTML

    def test_header_banner_landmark(self):
        assert '<header' in DASHBOARD_HTML

    def test_hash_routes_defined(self):
        for route in ("#today", "#world", "#journal", "#settings"):
            assert f'href="{route}"' in DASHBOARD_HTML

    def test_reduced_motion_override(self):
        assert "prefers-reduced-motion" in DASHBOARD_HTML

    def test_focus_visible_outline(self):
        assert ":focus-visible" in DASHBOARD_HTML
        assert "outline" in DASHBOARD_HTML

    def test_light_color_scheme_override(self):
        assert "prefers-color-scheme: light" in DASHBOARD_HTML

    def test_existing_dark_palette_preserved(self):
        # Aubergine house palette (0.1 Figma export, Rylee 2026-09-06);
        # no new hues introduced, only the documented dark palette
        for hex_color in ("#0a0810", "#f0eaff", "#2a2538", "#12101a", "#a397b8"):
            assert hex_color in DASHBOARD_HTML

    def test_no_other_dashboard_html_constant(self):
        # The single source of truth: this string appears once in the
        # module. If a duplicate ever slips in, this catches it.
        from personal_world import api as api_mod
        src = Path(api_mod.__file__).read_text()
        # Count top-level "DASHBOARD_HTML = \"" assignments, not every reference.
        assert len(re.findall(r"^DASHBOARD_HTML\s*=", src, flags=re.M)) == 1


class TestDashboardAccessibility:
    """Owner-profile rules that must hold in the rendered shell."""

    def test_status_is_word_text_not_color_only(self):
        # Status words appear as content, not as class-name color hints.
        for word in ("healthy", "unavailable", "unhealthy", "unknown"):
            assert word in DASHBOARD_HTML

    def test_no_inline_event_handlers(self):
        # All event binding goes through addEventListener in the script.
        for forbidden in ("onclick=", "onload=", "onerror=", "onkeydown="):
            assert forbidden not in DASHBOARD_HTML

    def test_escape_helper_uses_text_content(self):
        # The esc() helper must not interpolate raw API strings.
        assert "function esc(" in DASHBOARD_HTML
        assert "createTextNode" in DASHBOARD_HTML or "textContent" in DASHBOARD_HTML
        # No unsafe innerHTML for user-supplied data paths
        assert "innerHTML" not in DASHBOARD_HTML or DASHBOARD_HTML.count(
            "innerHTML") <= 1  # the legacy const in esc() returning escaped text

    def test_table_inside_scrollable_region(self):
        # Keyboard users can scroll wide tables
        assert 'role="region"' in DASHBOARD_HTML
        assert "tabindex=\"0\"" in DASHBOARD_HTML


class TestDashboardEndpoint:
    def test_root_returns_html(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "t")
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        app = create_app(tmp_path, tmp_path)
        c = TestClient(app)
        r = c.get("/")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]
        assert "Personal World — Today" in r.text