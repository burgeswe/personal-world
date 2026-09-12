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
        assert "<title>Project Worlds — Today</title>" in DASHBOARD_HTML

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

    def test_each_view_owns_a_page_heading(self):
        for route in ("today", "chat", "world", "journal", "vault", "settings"):
            assert f'<h1 id="{route}-h1">' in DASHBOARD_HTML

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
        # Aubergine house palette (0.1 Figma export, the operator 2026-09-06);
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
        (tmp_path / "setup-complete").write_text("ok")
        app = create_app(tmp_path, tmp_path)
        c = TestClient(app)
        r = c.get("/")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]
        assert "Project Worlds — Today" in r.text


class TestDashboardStyleInjection:
    """Regression: CSS-as-visible-text. The server-side prefs injection
    used to consume the main stylesheet's opening <style> tag, orphaning
    the whole dashboard CSS as literal page text (observed live
    2026-09-07). These tests fail if that class of bug returns."""

    def _rendered(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        from personal_world.api import create_app
        monkeypatch.setenv("PW_API_TOKEN", "t")
        monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
        (tmp_path / "setup-complete").write_text("ok")
        c = TestClient(create_app(tmp_path, tmp_path))
        return c.get("/").text

    def test_main_stylesheet_open_tag_survives_render(self, tmp_path, monkeypatch):
        # The head must retain TWO style elements after prefs injection.
        html = self._rendered(tmp_path, monkeypatch)
        head = html.split("</head>")[0]
        assert head.count("<style") == 2, (
            "main stylesheet lost its opening tag; CSS would render as text"
        )

    def test_no_css_leaks_outside_style_elements(self, tmp_path, monkeypatch):
        # Strip every <style>...</style> block; the remainder must not
        # contain CSS selector/property syntax as bare text.
        import re as _re
        html = self._rendered(tmp_path, monkeypatch)
        outside = _re.sub(r"<style\b.*?</style>", "", html, flags=_re.S)
        for token in ("--bg:", "--panel:", "box-sizing:", "display: none",
                      "background: var(", "max-width:"):
            assert token not in outside, (
                f"CSS leaked as visible text: {token!r}"
            )

    def test_prefs_block_rendered_with_id(self, tmp_path, monkeypatch):
        html = self._rendered(tmp_path, monkeypatch)
        assert '<style id="pw-prefs">' in html

    def test_marker_fully_replaced_no_comment_left(self, tmp_path, monkeypatch):
        from personal_world.api import PREFS_STYLE_MARKER
        html = self._rendered(tmp_path, monkeypatch)
        assert PREFS_STYLE_MARKER not in html

    def test_marker_present_in_template_source(self):
        # The injection anchor must exist exactly once in the template.
        assert DASHBOARD_HTML.count("<!--PW-PREFS-STYLE-->") == 1
        # And the template's main style tag must still be present.
        assert DASHBOARD_HTML.count("<style>") == 1

class TestDashboardLoadStates:
    """Live-verified 2026-09-07: after a successful load, the login row
    must actually disappear (#login[hidden] must beat display:flex)."""

    def test_auth_form_uses_one_current_id(self):
        assert '<form id="auth-box">' in DASHBOARD_HTML
        assert "#auth-box[hidden] { display: none; }" in DASHBOARD_HTML
        assert "$('login')" not in DASHBOARD_HTML

    def test_fresh_session_enters_load_flow(self):
        assert "syncRoute();\nload();" in DASHBOARD_HTML

    def test_capability_age_uses_row_scoped_value(self):
        assert "ageText(caps[k].last_observed)" in DASHBOARD_HTML

    def test_primary_today_actions_are_bound(self):
        assert "$('note-save').addEventListener('click', saveNote)" in DASHBOARD_HTML
        assert "$('svc-add').addEventListener('click'" in DASHBOARD_HTML

    def test_chat_keyboard_and_session_continuity_are_bound(self):
        assert "event.key === 'Enter' && !event.shiftKey" in DASHBOARD_HTML
        assert "sessionStorage.setItem(state.chatStorageKey" in DASHBOARD_HTML
        assert "restoreChat(token)" in DASHBOARD_HTML
        assert "'pw_chat_history_' + chatTokenScope(token)" in DASHBOARD_HTML
        assert "]).slice(-6)" in DASHBOARD_HTML

    def test_unknown_state_is_not_reported_as_quietly_healthy(self):
        assert "Some details are still unknown" in DASHBOARD_HTML

    def test_chat_uses_one_restrained_live_region(self):
        chat_log = DASHBOARD_HTML.split('id="chat-log"', 1)[1].split(">", 1)[0]
        assert "aria-live" not in chat_log
        assert 'role="region" aria-label="Conversation"' in DASHBOARD_HTML
        assert 'id="chat-status" role="status" aria-live="polite"' in DASHBOARD_HTML
        assert "setChatStatus('Thinking… You can keep reading while your world checks its sources.', false, false)" in DASHBOARD_HTML
        assert "setMsg('Opening your world…', false, false)" in DASHBOARD_HTML

    def test_note_save_has_concurrency_and_composition_guards(self):
        assert "if (state.noteBusy) return" in DASHBOARD_HTML
        assert "!event.isComposing" in DASHBOARD_HTML

    def test_lazy_routes_clear_busy_marker_for_retry(self):
        assert "state.routeLoads[route] = false" in DASHBOARD_HTML

    def test_auth_loads_cannot_overlap(self):
        assert "if (state.authBusy) return" in DASHBOARD_HTML
        assert "releaseAuth();" in DASHBOARD_HTML

    def test_authenticated_preferences_reapply_root_state(self):
        assert "function applyPreferences(saved)" in DASHBOARD_HTML
        assert "applyPreferences(state.prefs);" in DASHBOARD_HTML

    def test_phone_chat_composer_clears_bottom_navigation(self):
        assert ".chat-form { bottom: calc(61px + env(safe-area-inset-bottom, 0px)); }" in DASHBOARD_HTML

    def test_chat_companion_is_decorative(self):
        assert 'data-pw-companion-slot="chat" aria-hidden="true"' in DASHBOARD_HTML
        assert 'alt="" width="48" height="48"' in DASHBOARD_HTML

    def test_no_bare_loading_state_after_error_paths(self):
        # Every exit path sets an explicit human message; the shell never
        # leaves a generic loading label as the only explanation.
        assert "setMsg('Opening your world" in DASHBOARD_HTML
        assert "setMsg('Project Worlds could not be reached" in DASHBOARD_HTML
        assert "setMsg('That access code did not unlock your world" in DASHBOARD_HTML
        assert "setMsg('Project Worlds is not ready for access yet" in DASHBOARD_HTML
        assert "setMsg('Your world is ready.', true)" in DASHBOARD_HTML
