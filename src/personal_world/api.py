"""Secure API. One core; CLI, dashboard, and AI tools all consume it.

Auth: bearer token (private-notes Pattern C). Fail-closed: no token
configured -> protected routes 503; wrong token -> 401. The token is
compared with hmac.compare_digest and never logged.
"""

import hmac
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, FileResponse

from . import export, prefs
from .app import build_registry, load_world, save_world
from .chat import chat_once, build_chat_messages
from .chat_context import build_world_context
from .envelope import Result
from .journal import AuditRenderer, Journal
from .loop import daily
from .providers.registry import Registry
from .source_control import (
    discover_repositories,
    repository_history,
    status_all,
)
from .world import World


def _token() -> str | None:
    return os.environ.get("PW_API_TOKEN")


async def require_auth(request: Request) -> None:
    token = _token()
    if not token:
        raise HTTPException(status_code=503, detail="auth not configured")
    header = request.headers.get("Authorization", "")
    supplied = header.removeprefix("Bearer ").strip()
    if not supplied or not hmac.compare_digest(supplied, token):
        raise HTTPException(status_code=401, detail="unauthorized")


def create_app(data_dir: Path | None = None, config_dir: Path | None = None) -> FastAPI:
    data_dir = Path(data_dir or os.environ.get("PW_DATA_DIR", "./data"))
    config_dir = Path(config_dir or os.environ.get("PW_CONFIG_DIR", "./config"))
    world_path = data_dir / "world.json"
    journal = Journal(data_dir / "journal.ndjson")

    app = FastAPI(title="Personal World", version="0.1.0")

    @app.get("/healthz")
    async def healthz() -> dict:
        token = _token()
        return {
            "ok": True,
            "auth_configured": token is not None,
        }

    def _state() -> tuple[World, Registry]:
        world = load_world(world_path)
        registry = build_registry(world, Registry(), config_dir)
        return world, registry

    @app.get("/api/status", dependencies=[Depends(require_auth)])
    async def status() -> dict:
        world, registry = _state()
        s = world.summary()
        s["capabilities"] = registry.status_map()
        s["actors"] = [a.model_dump(mode="json") for a in registry.actors()]
        return {"ok": True, "status": "healthy", "data": s}

    @app.get("/api/daily", dependencies=[Depends(require_auth)])
    async def daily_view() -> dict:
        world, registry = _state()
        result = daily(world, registry, journal)
        save_world(world, world_path)
        return result.model_dump(mode="json")

    @app.get("/api/journal", dependencies=[Depends(require_auth)])
    async def journal_view(n: int = 20) -> dict:
        events = journal.recent(n)
        return {
            "ok": True,
            "data": [e.model_dump(mode="json") for e in events],
        }

    @app.get("/api/journal/audit", dependencies=[Depends(require_auth)])
    async def journal_audit() -> dict:
        return {"ok": True, "data": {"text": AuditRenderer().render(journal)}}

    @app.get("/api/memory/search", dependencies=[Depends(require_auth)])
    async def memory_search(q: str, top_k: int = 5) -> dict:
        """Semantic recall through the memory provider. Private data
        class: results are personal context, never settings-exportable."""
        from .model import Capability  # noqa: F401  (capability exists)
        _, registry = _state()
        provider = registry.provider_for("memory")
        if provider is None:
            return {"ok": False, "status": "unavailable",
                    "warnings": ["no memory provider"]}
        impl = registry.impl(provider.name)
        if not hasattr(impl, "search"):
            return {"ok": False, "status": "unavailable",
                    "warnings": [f"provider '{provider.name}' cannot search"]}
        result = impl.search(q, top_k=top_k)
        return result.model_dump(mode="json")

    @app.post("/api/chat", dependencies=[Depends(require_auth)])
    async def chat(request: Request) -> dict:
        """Conversational interface to Personal World.

        Read-only: the model observes a rendered world snapshot and
        returns text. No tool execution, no mutations. With no chat
        provider configured the endpoint answers 'not_configured' so
        the dashboard can degrade honestly."""
        body: dict
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        message = (body.get("message") or "").strip() if isinstance(body, dict) else ""
        if not message:
            raise HTTPException(status_code=400, detail="message is required")
        history = body.get("history") if isinstance(body, dict) else None
        if not isinstance(history, list):
            history = []
        history = [
            {"role": m.get("role"), "content": m.get("content")}
            for m in history[-6:]
            if isinstance(m, dict) and m.get("content")
        ]
        world, registry = _state()
        provider = registry.provider_for("reasoning")
        if provider is None:
            return {
                "ok": False,
                "status": "not_configured",
                "warnings": [
                    "no chat provider configured — add an ollama or "
                    "openai_compat connection to config"
                ],
            }
        impl = registry.impl(provider.name)
        context = build_world_context(world, registry, journal,
                                      config_dir=config_dir)
        messages = build_chat_messages(message, context, history)
        result = chat_once(impl, messages)
        if not result.ok:
            return result.model_dump(mode="json")
        journal.record(
            "recommendation",
            f"chat exchange with {provider.name} ({len(message)} chars in)",
            source="chat",
        )
        return result.model_dump(mode="json")

    @app.get("/api/actors", dependencies=[Depends(require_auth)])
    async def actors() -> dict:
        _, registry = _state()
        return {
            "ok": True,
            "data": [a.model_dump(mode="json") for a in registry.actors()],
        }

    @app.get("/api/manifest", dependencies=[Depends(require_auth)])
    async def manifest() -> dict:
        """Machine-readable capability manifest (framework contract:
        see docs/NATIVE-BASELINE-AND-ENRICHMENT.md)."""
        _, registry = _state()
        return {"ok": True, "data": registry.manifest()}

    @app.get("/api/exports/settings", dependencies=[Depends(require_auth)])
    async def settings_export() -> dict:
        world, _ = _state()
        return {"ok": True, "data": export.settings_export(world)}

    @app.get("/api/exports/world", dependencies=[Depends(require_auth)])
    async def world_export() -> dict:
        world, _ = _state()
        return {"ok": True, "data": export.world_export(world)}

    @app.get("/api/exports/story", dependencies=[Depends(require_auth)])
    async def story_export() -> dict:
        return {"ok": True, "data": {"text": export.story_export(journal)}}

    @app.get("/api/backup", dependencies=[Depends(require_auth)])
    async def backup() -> dict:
        world, _ = _state()
        return {"ok": True, "data": export.backup_payload(world, journal)}

    @app.get("/api/updates", dependencies=[Depends(require_auth)])
    async def updates_view() -> dict:
        """Read-only check + status overview. API is check/status only:
        apply/rollback are CLI-only, deliberately -- destructive actions
        need the explicit-confirm CLI path with its visible exit codes."""
        from .updates import UpdateManager, build_provider

        provider = build_provider(
            config_dir=config_dir,
            project_dir=os.environ.get("PW_UPDATES_PROJECT_DIR") or None,
        )
        if provider is None:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no update target configured"]}
        manager = UpdateManager(
            provider,
            journal,
            session_path=data_dir / "updates-session.json",
        )
        checks = manager.check()
        return {
            "ok": True,
            "status": "healthy",
            "data": {
                "provider": provider.name,
                "checks": {
                    t: c.model_dump(mode="json") for t, c in checks.items()
                },
                "session": manager.status(live=False),
            },
        }

    @app.get("/api/prefs", dependencies=[Depends(require_auth)])
    async def prefs_get() -> dict:
        world, _ = _state()
        return {"ok": True, "data": prefs.get_prefs(world)}

    @app.put("/api/prefs", dependencies=[Depends(require_auth)])
    async def prefs_put(request: Request) -> dict:
        world, _ = _state()
        try:
            updates = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        try:
            data = prefs.set_prefs(world, updates)
        except prefs.PrefsValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        save_world(world, world_path)
        return {"ok": True, "data": data}
    # -- source_control: native git baseline (zero providers required) --
    def _sc_paths() -> list[str]:
        from .source_control import configured_search_paths
        return configured_search_paths(config_dir)

    @app.get("/api/source-control/status", dependencies=[Depends(require_auth)])
    async def source_control_status() -> dict:
        paths = _sc_paths()
        if not paths:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no source_control search paths configured"]}
        repos = [
            r for r in status_all(paths)
            if r.get("error") is None or r.get("branch") is not None
        ]
        if not repos:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no git repositories found in configured "
                                 "search paths"]}
        return {"ok": True, "status": "healthy", "data": {"repos": repos}}

    @app.get("/api/source-control/history", dependencies=[Depends(require_auth)])
    async def source_control_history(repo: str, limit: int = 20) -> dict:
        paths = _sc_paths()
        if not paths:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no source_control search paths configured"]}
        matches = [
            e for e in discover_repositories(paths)
            if e["is_repository"] and e["name"] == repo
        ]
        if not matches:
            return {"ok": False, "status": "not_configured",
                    "warnings": [f"repository '{repo}' not found in "
                                 "configured search paths"]}
        commits = repository_history(matches[0]["path"], limit)
        return {"ok": True, "status": "healthy",
                "data": {"repo": repo, "commits": commits}}

    @app.get("/", response_class=HTMLResponse)
    async def dashboard() -> HTMLResponse:
        # Dashboard shell: static HTML that fetches /api/* with the
        # session's token. Auth is enforced per API call; the shell
        # itself is inert without a valid token. Presentation prefs are
        # server-rendered (CSS custom properties + data-* attributes),
        # so preference application works with JavaScript disabled.
        world, _ = _state()
        p = prefs.get_prefs(world)
        attrs = " ".join(
            f'{k}="{v}"' for k, v in prefs.prefs_to_data_attributes(p).items()
        )
        return HTMLResponse(
            DASHBOARD_HTML
            .replace("<html lang=\"en\">", f'<html lang="en" {attrs}>')
            .replace(PREFS_STYLE_MARKER, str(prefs.prefs_style_block(p)), 1)
        )

    companion_dir = Path(__file__).parent / "static" / "companions"
    _COMPANION_FILES = {
        "personal-world": "personal-world.svg",
        "mermaid": "mermaid.svg",
        "robot": "robot.svg",
        "world-tree-squirrel": "world-tree-squirrel.svg",
        "taco-news-truck": "taco-news-truck.svg",
    }

    @app.get("/companions/{name}.svg")
    async def companion_svg(name: str) -> Response:
        # Approved companion source rigs, byte-identical copies of the
        # design-owned artwork (see design/assets/companions/). Public:
        # decorative identity, carries no world state.
        filename = _COMPANION_FILES.get(name)
        if filename is None or not companion_dir.exists():
            raise HTTPException(status_code=404, detail="unknown companion")
        path = companion_dir / filename
        if not path.exists():
            raise HTTPException(status_code=404, detail="companion art missing")
        return FileResponse(path, media_type="image/svg+xml")

    static_dir = Path(__file__).parent / "static"

    @app.get("/icons/sprite.svg")
    async def icon_sprite() -> Response:
        # 72-glyph production icon system (design/assets/icons/). Public:
        # decorative geometry, stroke=currentColor, carries no world state.
        path = static_dir / "icons" / "sprite.svg"
        if not path.exists():
            raise HTTPException(status_code=404, detail="sprite missing")
        return FileResponse(path, media_type="image/svg+xml")

    @app.get("/fonts/{name}")
    async def webfont(name: str) -> Response:
        # Self-hosted Figma-export families (design/tokens.json
        # font.expressive / font.interface). Public: OFL-licensed
        # font binaries, no world state.
        allowed = {
            "young-serif-latin.woff2": "font/woff2",
            "instrument-sans-var-latin.woff2": "font/woff2",
        }
        ctype = allowed.get(name)
        if ctype is None or "/" in name or ".." in name:
            raise HTTPException(status_code=404, detail="unknown font")
        path = static_dir / "fonts" / name
        if not path.exists():
            raise HTTPException(status_code=404, detail="font missing")
        return FileResponse(path, media_type=ctype, headers={
            "Cache-Control": "public, max-age=604800, immutable"})

    return app


# Replaced server-side with prefs.prefs_style_block() at render time.
# A marker, not "<style>", so injection can never consume the main
# stylesheet's opening tag (that bug orphaned the whole dashboard CSS
# as visible body text — see the dashboard regression tests).
PREFS_STYLE_MARKER = "<!--PW-PREFS-STYLE-->"
DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World — Today</title>
<!--PW-PREFS-STYLE-->
<style>
/* Figma-faithful theme (file VATVojyJZT9HKx0CrDS0yr, today-rylee-theme
   #3:2147, extracted via Figma MCP 2026-09-07). Tokens are the
   canonical repo design/tokens.json aubergine palette; families are
   the self-hosted Figma-export fonts. Layout mirrors the design's
   sidebar rail + reading column. Accessibility floor unchanged. */
@font-face {
  font-family: "Young Serif";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/young-serif-latin.woff2") format("woff2");
}
@font-face {
  font-family: "Instrument Sans";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("/fonts/instrument-sans-var-latin.woff2") format("woff2");
}
:root {
  color-scheme: dark;
  /* Canonical design tokens (design/tokens.json, aubergine palette) */
  --surface-canvas: #0a0810;
  --surface-panel: #12101a;
  --surface-elevated: #1a1724;
  --border-subtle: #2a2538;
  --text-primary: #f0eaff;
  --text-secondary: #a397b8;
  --text-muted: #6b5f82;
  --accent-primary: #72b1b1;
  --accent-secondary: #b57f8b;
  /* Figma rylee-theme surface additions (inset + badge ring) */
  --surface-inset: #13111c;
  --bg: var(--surface-canvas); --text: var(--text-primary);
  --border: var(--border-subtle); --panel: var(--surface-panel);
  --muted: var(--text-secondary);
  /* Figma type scale (today-rylee-theme) */
  --font-expressive: "Young Serif", system-ui, sans-serif;
  --font-interface: "Instrument Sans", system-ui, sans-serif;
  --size-display: 2.5rem;      /* 40px greeting */
  --size-section: 1.375rem;    /* 22px world-health heading */
  --size-card-title: 1.125rem; /* 18px card titles */
  --size-body: 1rem;           /* 16px */
  --size-meta: 0.9375rem;      /* 15px timestamps/meta */
  --size-label: 0.875rem;      /* 14px card labels */
  --size-tag: 0.8125rem;       /* 13px journal tags */
  /* Figma layout: 72px rail, reading column */
  --rail-width: 72px;
}
@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --bg: #f4f2ed; --panel: #ece9e1; --border: #d9d4c9;
    --text: #26241f; --muted: #6b675f;
  }
}
[data-pw-accent="rylee"] {
  /* Figma rylee-theme accent-secondary (#B57F8B rose) — the design's
     own rose, not an invented pastel */
  --accent-secondary: #b57f8b;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text);
       font-family: var(--font-interface); margin: 0;
       line-height: 1.6; max-width: 100%;
       font-size: calc(1rem * var(--pw-text-scale, 1)); }

/* Layout: app shell = sidebar rail + reading column (Figma
   today-rylee-theme main-reading-content + sidebar-rail) */
.app-shell { display: flex; align-items: stretch; min-height: 100vh; }
.wrap { flex: 1; min-width: 0; margin-left: var(--rail-width); }
.rail { position: fixed; top: 0; bottom: 0; left: 0;
        width: var(--rail-width);
        display: flex; flex-direction: column; align-items: center;
        justify-content: space-between; padding: 2rem 0;
        border-right: 1px solid var(--border); background: var(--bg); }
.rail-group { display: flex; flex-direction: column; align-items: center;
              gap: 1rem; }
.rail-group.nav-gap { gap: 2.5rem; }
.appliance-logo { width: 44px; height: 44px; display: flex;
                  align-items: center; justify-content: center;
                  background: var(--surface-inset); border-radius: 12px;
                  font-family: var(--font-expressive); font-size: 1.25rem;
                  color: var(--accent-primary); }
.rail nav[aria-label="Main"] { display: flex; flex-direction: column;
                               gap: 0; }
.rail nav[aria-label="Main"] a { width: 44px; height: 44px;
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--text-secondary); text-decoration: none;
        border-radius: 8px; }
.rail nav[aria-label="Main"] a svg { width: 24px; height: 24px; }
.rail nav[aria-label="Main"] a:hover { background: var(--surface-inset); }
.rail nav[aria-label="Main"] a[aria-current="page"] {
        background: var(--surface-inset); color: var(--accent-primary); }
.rail .brand-companion { width: 32px; height: 32px; flex: 0 0 32px;
                         border-radius: 6px; overflow: hidden; }
.rail .brand-companion img { width: 100%; height: 100%; display: block; }

h1, h2, h3 { font-family: var(--font-interface); }
h1 { font-family: var(--font-expressive); font-size: 1.25rem; margin: 0;
     font-weight: 400; }
h2 { font-size: var(--size-section); margin: 1.5rem 0 0.5rem;
     color: var(--text); font-weight: 500; }
h3 { font-size: 0.95rem; margin: 1rem 0 0.25rem; color: var(--muted);
     font-weight: 500; }
section { margin-bottom: 1.5rem; }
p { margin: 0.5rem 0; }
ul { margin: 0.5rem 0; padding-left: 1.25rem; }
li { margin: 0.25rem 0; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0;
        font-size: 0.95rem; }
th, td { text-align: left; padding: 0.5rem 0.75rem;
         border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
th { color: var(--muted); font-weight: 500; }
.scroll { overflow-x: auto; }
code { background: var(--panel); padding: 0.1rem 0.3rem; border-radius: 4px;
       overflow-wrap: anywhere; }

/* Reading column (Figma: padding 64px 120px 80px, gap 56px between
   top-level sections; collapses at the 900px narrow design) */
main { padding: 4rem 7.5rem 5rem; display: flex;
       flex-direction: column; gap: 1rem; }
main > section { margin-bottom: 0; padding-bottom: 1rem; }
.greeting { display: flex; flex-wrap: wrap; align-items: flex-start;
            justify-content: space-between; gap: 1rem; }
.greeting h2 { font-family: var(--font-expressive);
               font-size: var(--size-display); font-weight: 400;
               margin: 0; color: var(--text); }
.greeting .meta-row { display: flex; align-items: center; gap: 0.5rem;
                      color: var(--text-secondary);
                      font-size: var(--size-meta); }
.meta-dot { width: 4px; height: 4px; border-radius: 50%;
            background: var(--accent-primary); display: inline-block; }
.motif-badge { display: inline-flex; align-items: center; gap: 0.5rem;
               padding: 0.625rem; border: 1px solid var(--border);
               border-radius: 999px; color: var(--text-secondary);
               font-size: 0.75rem; font-weight: 500; }
.motif-planet { width: 12px; height: 12px; border-radius: 50%;
                background: var(--accent-primary); display: inline-block; }
.hr { border: 0; border-top: 1px solid var(--border); margin: 0.75rem 0; }

header.banner { display: none; flex-wrap: wrap; align-items: center;
                gap: 1rem; padding-bottom: 1rem;
                border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
.brand-lockup { display: flex; align-items: center; gap: 0.75rem; }
.brand-companion { width: 32px; height: 32px; flex: 0 0 32px;
                   border-radius: 50%; }
.brand-companion img { width: 100%; height: 100%; display: block;
                       border-radius: 50%; }
/* Top nav fallback: hidden on desktop (rail carries nav), visible <900px */
header.banner nav[aria-label="Main"] { display: flex; gap: 0.25rem;
                                       flex-wrap: wrap; }
header.banner nav[aria-label="Main"] a {
        display: inline-flex; align-items: center;
        padding: 0.55rem 0.9rem;
        min-width: var(--pw-target-size, 44px);
        min-height: var(--pw-target-size, 44px);
        color: var(--text); text-decoration: none;
        border: 1px solid var(--border); border-radius: 6px;
        background: var(--panel); }
header.banner nav[aria-label="Main"] a[aria-current="page"] {
        border-color: var(--text); }
#login { display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap; }
/* The load flow sets [hidden] after a successful token check; without
   this rule display:flex would override the UA's [hidden] and the
   login form would never leave the screen. */
#login[hidden] { display: none; }
input, textarea, select { background: var(--panel); color: var(--text);
        border: 1px solid var(--border); border-radius: 6px;
        padding: 0.55rem; font-size: 1rem; font-family: inherit;
        min-width: var(--pw-target-size, 44px);
        min-height: var(--pw-target-size, 44px); }
textarea { width: 100%; resize: vertical; }
button { background: var(--panel); color: var(--text);
         border: 1px solid var(--border); border-radius: 6px;
         padding: 0.55rem 1rem; font-size: 1rem;
         font-family: var(--font-interface);
         min-width: var(--pw-target-size, 44px);
         min-height: var(--pw-target-size, 44px); cursor: pointer; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
button[aria-pressed="true"] { border-color: var(--text); }
.skip { position: absolute; left: -9999px; top: auto; z-index: 20; }
.skip:focus { left: 5.5rem; top: 1rem; background: var(--panel);
              padding: 0.5rem; border: 1px solid var(--text); z-index: 20; }
:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.muted { color: var(--muted); }
#msg { color: var(--muted); padding: 0 7.5rem; }
.view { display: none; }
.view.active { display: block; }
/* Status chips: luminance + text word, never color-only */
.chip { display: inline-block; padding: 0.05rem 0.5rem;
        border: 1px solid var(--border); border-radius: 999px;
        font-size: 0.85rem; background: var(--panel); }
.chip-healthy { border-color: var(--accent-primary); }
.chip-unhealthy, .chip-needs_attention { border-color: var(--accent-secondary); }
.chip-unavailable, .chip-not_configured { border-style: dashed; }
/* Cards */
.cards { display: grid; gap: 0.75rem; }
.card { background: var(--panel); border: 1px solid var(--border);
        border-radius: 8px; padding: 0.75rem 1rem; }
.card h3 { margin-top: 0; }
/* Attention rows (Figma: 40px inset icon tile + two-line label) */
.attention-item { display: flex; align-items: center; gap: 1rem;
                  padding: 0.75rem 0; }
.attention-item .icon-container { width: 40px; height: 40px; flex: 0 0 40px;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--surface-inset); border-radius: 8px;
        color: var(--text-secondary); }
.attention-item .icon-container svg { width: 20px; height: 20px; }
.attention-item .lines { display: flex; flex-direction: column; gap: 2px; }
.attention-item .lines .title { font-weight: 500; color: var(--text); }
.attention-item .lines .detail { color: var(--text-secondary);
                                 font-size: var(--size-meta); }
/* Chat surface */
#chat-log { display: flex; flex-direction: column; gap: 0.75rem;
            min-height: 8rem; }
.chat-msg { border-radius: 8px; padding: 0.6rem 0.9rem; max-width: 90%; }
.chat-msg.user { align-self: flex-end; background: var(--surface-elevated);
                 border: 1px solid var(--border); }
.chat-msg.assistant { align-self: flex-start; background: var(--panel);
                      border: 1px solid var(--border); white-space: pre-wrap; }
.chat-msg.error { align-self: stretch; background: var(--panel);
                  border: 1px dashed var(--accent-secondary); }
.chat-form { display: flex; gap: 0.5rem; margin-top: 0.75rem;
             align-items: flex-start; }
.chat-form textarea { flex: 1; min-height: 44px; }
.chat-companion { display: flex; align-items: flex-end; gap: 0.5rem; }
.chat-companion img { width: 48px; height: 48px; }
.prefs-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;
             margin: 0.5rem 0; }
.prefs-row label { min-width: 10rem; }
details.provenance { margin: 0.25rem 0; }
details.provenance summary { cursor: pointer; color: var(--muted); }
.journal-filters { display: flex; flex-wrap: wrap; gap: 0.25rem;
                   margin-bottom: 0.5rem; }
/* Narrow design (Figma today-hybrid-narrow-900 + responsive cascade):
   rail collapses to a top banner under 900px */
@media (max-width: 900px) {
  .app-shell { flex-direction: column; }
  .rail { position: static; width: auto; flex-direction: row;
          padding: 0.75rem 1rem; border-right: 0;
          border-bottom: 1px solid var(--border); }
  .wrap { margin-left: 0; }
  .rail nav[aria-label="Main"] { flex-direction: row; }
  header.banner { display: flex; }
  .rail-only { display: none; }
  main { padding: 1.5rem 1rem 2rem; }
  #msg { padding: 0 1rem; }
}
@media (max-width: 640px) {
  body { padding: 0; }
  .chat-msg { max-width: 100%; }
  main { padding: 1rem 0.75rem 2rem; }
  #msg { padding: 0 0.75rem; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>
<a class="skip" href="#main-content">Skip to main content</a>
<div class="app-shell">
<nav class="rail rail-only" aria-label="Main">
<div class="rail-group">
<span class="appliance-logo" aria-hidden="true">p</span>
<div class="rail-group nav-gap">
<a href="#today" data-route="today" aria-label="Today"><svg aria-hidden="true" width="24" height="24"><use href="/icons/sprite.svg#icon-navigation-today"></use></svg></a>
<a href="#chat" data-route="chat" aria-label="Chat"><svg aria-hidden="true" width="24" height="24"><use href="/icons/sprite.svg#icon-navigation-chat"></use></svg></a>
<a href="#world" data-route="world" aria-label="Worlds"><svg aria-hidden="true" width="24" height="24"><use href="/icons/sprite.svg#icon-navigation-worlds"></use></svg></a>
<a href="#journal" data-route="journal" aria-label="Journal"><svg aria-hidden="true" width="24" height="24"><use href="/icons/sprite.svg#icon-navigation-journal"></use></svg></a>
</div>
</div>
<div class="rail-group">
<span class="brand-companion" data-pw-companion-slot="brand"><img
 src="/companions/personal-world.svg" alt="" width="32" height="32"></span>
<a href="#settings" data-route="settings" aria-label="Settings"><svg aria-hidden="true" width="24" height="24"><use href="/icons/sprite.svg#icon-navigation-settings"></use></svg></a>
</div>
</nav>
<div class="wrap">
<header class="banner">
<div class="brand-lockup">
<span class="brand-companion" data-pw-companion-slot="brand"><img
 src="/companions/personal-world.svg" alt="" width="32" height="32"></span>
<h1 id="brand">Personal World</h1>
</div>
<nav aria-label="Main">
<a href="#today" data-route="today">Today</a>
<a href="#chat" data-route="chat">Chat</a>
<a href="#world" data-route="world">World</a>
<a href="#journal" data-route="journal">Journal</a>
<a href="#settings" data-route="settings">Settings</a>
</nav>
</header>
<div id="login">
<label for="token" class="muted" style="display:none">API token</label>
<input id="token" type="password" placeholder="API token" aria-label="API token">
<button id="go" aria-label="Show my world">Show my world</button>
</div>
<p id="msg" role="status" aria-live="polite">Token stays in this browser; requests go to /api/*.</p>
<main id="main-content">
<section id="view-today" class="view active" aria-labelledby="today-h1">
<div class="greeting">
<div>
<h2 id="today-h1">Today</h2>
<div class="meta-row"><span>Saturday, September 6</span><span class="meta-dot" aria-hidden="true"></span><span id="today-state-line">Personal World Appliance active</span></div>
</div>
<span class="motif-badge"><span class="motif-planet" aria-hidden="true"></span>Local Node 01</span>
</div>
<hr class="hr">
<section aria-labelledby="today-health-h2">
<h2 id="today-health-h2">World health</h2>
<div id="today-health" class="muted">Loading…</div>
</section>
<hr class="hr">
<section aria-labelledby="today-attention-h2">
<h2 id="today-attention-h2">Needs attention</h2>
<ul id="today-attention" class="cards"><li class="muted">Loading…</li></ul>
</section>
<hr class="hr">
<section aria-labelledby="today-changes-h2">
<h2 id="today-changes-h2">Recent changes</h2>
<div id="today-changes" class="muted">Loading…</div>
</section>
<hr class="hr">
<section aria-labelledby="today-caps-h2">
<h2 id="today-caps-h2">Capabilities</h2>
<div class="scroll" role="region" aria-label="Capabilities table" tabindex="0">
<table id="today-caps"><thead><tr><th>Area</th><th>Status</th></tr></thead>
<tbody><tr><td colspan="2" class="muted">Loading…</td></tr></tbody></table>
</div>
</section>
<hr class="hr">
<section aria-labelledby="today-journal-h2">
<h2 id="today-journal-h2">Recent journal</h2>
<ul id="today-journal"><li class="muted">Loading…</li></ul>
<p><a href="#journal">View all</a></p>
</section>
</section>
<section id="view-chat" class="view" aria-labelledby="chat-h1">
<h2 id="chat-h1">Chat</h2>
<section aria-labelledby="chat-surface-h2">
<h2 id="chat-surface-h2">Talk with your world</h2>
<div class="chat-companion">
<span data-pw-companion-slot="chat"><img src="/companions/personal-world.svg"
 alt="Companion illustration" width="48" height="48"></span>
<div id="chat-log" aria-live="polite" aria-label="Conversation">
<p class="muted" id="chat-empty">Ask about your world — status, changes, capabilities, or history. Answers come from your local model using a read-only snapshot of Personal World.</p>
</div>
</div>
<form class="chat-form" id="chat-form">
<label for="chat-input" class="muted" style="display:none">Message</label>
<textarea id="chat-input" rows="2" placeholder="Ask your world…"></textarea>
<button id="chat-send" type="submit">Send</button>
</form>
<p class="muted" id="chat-status"></p>
</section>
</section>
<section id="view-world" class="view" aria-labelledby="world-h1">
<h2 id="world-h1">World</h2>
<section aria-labelledby="world-facts-h2">
<h2 id="world-facts-h2">Intent &amp; policies</h2>
<div id="world-facts" class="muted">Loading…</div>
</section>
<section aria-labelledby="world-lore-h2">
<h2 id="world-lore-h2">Lore</h2>
<ul id="world-lore"><li class="muted">Loading…</li></ul>
</section>
<section aria-labelledby="world-actors-h2">
<h2 id="world-actors-h2">Actors</h2>
<div class="scroll" role="region" aria-label="Actors table" tabindex="0">
<table id="world-actors"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Writes</th></tr></thead>
<tbody><tr><td colspan="4" class="muted">Loading…</td></tr></tbody></table>
</div>
</section>
<section aria-labelledby="world-src-h2">
<h2 id="world-src-h2">Source repositories</h2>
<div id="world-src" class="muted">Loading…</div>
</section>
<section aria-labelledby="world-updates-h2">
<h2 id="world-updates-h2">Updates</h2>
<div id="world-updates" class="muted">Loading…</div>
</section>
</section>
<section id="view-journal" class="view" aria-labelledby="journal-h1">
<h2 id="journal-h1">Journal</h2>
<div class="journal-filters" role="group" aria-label="Filter by kind">
<button type="button" class="jfilter" data-kind="" aria-pressed="true">All</button>
<button type="button" class="jfilter" data-kind="observation" aria-pressed="false">Observations</button>
<button type="button" class="jfilter" data-kind="drift" aria-pressed="false">Drift</button>
<button type="button" class="jfilter" data-kind="failure" aria-pressed="false">Failures</button>
<button type="button" class="jfilter" data-kind="settings_change" aria-pressed="false">Settings</button>
</div>
<ul id="journal-list"><li class="muted">Loading…</li></ul>
<p><button id="journal-more" type="button">Load more</button></p>
</section>
<section id="view-settings" class="view" aria-labelledby="settings-h1">
<h2 id="settings-h1">Settings</h2>
<section aria-labelledby="settings-appearance-h2">
<h2 id="settings-appearance-h2">Reading &amp; interaction</h2>
<p class="muted">Preferences apply immediately and are saved to your world. The accessibility floor (44px targets, reduced motion, high contrast) can never be lowered.</p>
<div id="settings-prefs" class="muted">Loading…</div>
</section>
<section aria-labelledby="settings-export-h2">
<h2 id="settings-export-h2">Capability &amp; pack settings</h2>
<p class="muted">Settings export is whitelist-based; private and secret material never appears here.</p>
<div id="settings-body" class="muted">Loading…</div>
</section>
</section>
</main>
</div>
<script>
const $ = id => document.getElementById(id);
function esc(s) { const d = document.createElement('span');
  d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function el(tag, text, attrs) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = String(text);
  if (attrs) for (const k in attrs) if (k === 'class') n.className = attrs[k];
  return n;
}
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
function setMsg(t) { $('msg').textContent = t; }
function nowHHMM() {
  const d = new Date();
  const p = x => String(x).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes());
}
function statusWord(s) {
  if (s == null) return 'unknown';
  const t = String(s).toLowerCase();
  if (t === 'healthy' || t === 'ok') return 'healthy';
  if (t === 'unhealthy') return 'unhealthy';
  if (t === 'unavailable') return 'unavailable';
  if (t === 'needs_attention') return 'needs attention';
  if (t === 'not_configured') return 'not configured';
  return t;
}
function chip(status) {
  const raw = String(status == null ? 'unknown' : status).toLowerCase();
  const word = statusWord(raw);
  const span = el('span', word);
  span.className = 'chip chip-' + raw;
  return span;
}
async function api(token, path, opts) {
  const headers = {'Authorization': 'Bearer ' + token};
  if (opts && opts.body) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, Object.assign({}, opts, {headers}));
  if (r.status === 401) return {error: 'unauthorized'};
  if (r.status === 503) return {error: 'no_auth'};
  if (r.status === 400) { const j = await r.json().catch(() => ({}));
    return {error: j.detail || 'bad_request'}; }
  if (!r.ok) return {error: 'http_' + r.status};
  return {data: await r.json()};
}
function rankStatus(s) {
  const order = {'unavailable': 3, 'unhealthy': 2, 'needs attention': 2,
                 'not configured': 2, 'unknown': 1, 'healthy': 0};
  return order[String(s).toLowerCase()] != null
    ? order[String(s).toLowerCase()] : 0;
}
/* ---- prefs: immediate apply + persistence ---- */
const PREF_SPEC = [
  {key: 'text_scale', label: 'Text size', type: 'select',
   options: [['1.0', 'Normal'], ['1.25', 'Large'], ['1.5', 'Largest']]},
  {key: 'density', label: 'Density', type: 'select',
   options: [['comfortable', 'Comfortable'], ['compact', 'Compact']]},
  {key: 'target_size', label: 'Touch targets', type: 'select',
   options: [['44', 'Standard (44px)'], ['56', 'Large (56px)']]},
  {key: 'companion', label: 'Companion', type: 'select',
   options: [['personal-world', 'Personal World'], ['mermaid', 'Mermaid'],
             ['robot', 'Little Helper Robot'],
             ['world-tree-squirrel', 'World-tree Squirrel'],
             ['taco-news-truck', 'Tacos & the Morning Paper']]},
  {key: 'accent', label: 'Accent palette', type: 'select',
   options: [['world-keeper', 'World Keeper'], ['rylee', 'Rylee (pastel pink)']]},
];
function applyCompanion(key) {
  const slots = document.querySelectorAll('[data-pw-companion-slot]');
  const url = '/companions/' + encodeURIComponent(key) + '.svg';
  for (const s of slots) {
    const img = s.querySelector('img');
    if (img) { img.src = url; }
  }
}
function buildSettingsPrefs(saved) {
  const host = $('settings-prefs'); clear(host);
  for (const spec of PREF_SPEC) {
    const row = el('div'); row.className = 'prefs-row';
    const label = el('label', spec.label, {});
    label.setAttribute('for', 'pref-' + spec.key);
    const sel = el('select');
    sel.id = 'pref-' + spec.key;
    for (const [v, name] of spec.options) {
      const opt = el('option', name); opt.value = v;
      if (String(saved[spec.key]) === v) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', async () => {
      const upd = {};
      upd[spec.key] = spec.key === 'target_size'
        ? parseInt(sel.value, 10) : sel.value;
      const res = await api(state.token, '/api/prefs', {
        method: 'PUT', body: JSON.stringify(upd)});
      if (res.error) { setMsg('Preference rejected: ' + res.error); return; }
      document.documentElement.setAttribute('data-pw-' +
        spec.key.replace('_', '-'), String(sel.value).replace('_', '-'));
      if (spec.key === 'text_scale')
        document.documentElement.style.setProperty('--pw-text-scale', sel.value);
      if (spec.key === 'target_size')
        document.documentElement.style.setProperty('--pw-target-size', sel.value + 'px');
      if (spec.key === 'companion') applyCompanion(sel.value);
      if (spec.key === 'accent')
        document.documentElement.setAttribute('data-pw-accent', sel.value);
      setMsg('Saved ' + spec.label.toLowerCase() + ' — ' + nowHHMM());
    });
    row.appendChild(label); row.appendChild(sel); host.appendChild(row);
  }
  const note = el('p', 'Motion stays reduced and contrast stays high by design; the accessibility floor is not user-lowerable.', 'muted');
  host.appendChild(note);
}
/* ---- Today ---- */
function renderToday() {
  const caps = (state.status && state.status.data && state.status.data.capabilities) || {};
  const capKeys = Object.keys(caps);
  const healthy = capKeys.filter(k => caps[k].status === 'healthy').length;
  const total = capKeys.length;
  const worst = capKeys.map(k => statusWord(caps[k].status))
    .sort((a, b) => rankStatus(b) - rankStatus(a))[0] || 'unknown';
  const healthDiv = $('today-health'); clear(healthDiv);
  healthDiv.appendChild(el('p', 'Worst capability status: ' + worst + '. ' +
    healthy + ' healthy of ' + total + ' declared.'));
  const att = $('today-attention'); clear(att);
  const items = (state.daily && state.daily.data && state.daily.data.attention) || [];
  if (items.length === 0) {
    att.appendChild(el('li', 'Nothing needs your attention.'));
  } else {
    for (const a of items) att.appendChild(el('li', a));
  }
  const ch = $('today-changes'); clear(ch);
  const changed = (state.daily && state.daily.data && state.daily.data.actions) || [];
  if (changed.length === 0) {
    ch.appendChild(el('p', 'No recorded changes in the latest daily pass.'));
  } else {
    const ul = el('ul');
    for (const c of changed.slice(0, 8)) ul.appendChild(el('li', c));
    ch.appendChild(ul);
  }
  const tbody = $('today-caps').querySelector('tbody'); clear(tbody);
  if (capKeys.length === 0) {
    const tr = el('tr'); const td = el('td', 'No capabilities defined.');
    td.setAttribute('colspan', '2'); tr.appendChild(td); tbody.appendChild(tr);
  } else {
    for (const k of capKeys) {
      const tr = el('tr');
      tr.appendChild(el('td', k));
      const td = el('td'); td.appendChild(chip(caps[k].status));
      if (caps[k].warnings && caps[k].warnings.length) {
        td.appendChild(document.createTextNode(' — ' + caps[k].warnings[0]));
      }
      tr.appendChild(td); tbody.appendChild(tr);
    }
  }
  const jl = $('today-journal'); clear(jl);
  const events = (state.journal && state.journal.data) || [];
  const last5 = events.slice(-5).reverse();
  if (last5.length === 0) {
    jl.appendChild(el('li', 'No journal entries yet.'));
  } else {
    for (const e of last5) {
      const li = el('li');
      const t = el('time', (e.ts || '').toString().slice(0, 16).replace('T', ' '));
      li.appendChild(t); li.appendChild(document.createTextNode(' — '));
      li.appendChild(document.createTextNode(e.kind + ': ' + e.summary));
      jl.appendChild(li);
    }
  }
}
/* ---- World ---- */
function renderWorld() {
  const wf = $('world-facts'); clear(wf);
  const w = state.world && state.world.data || {};
  const intents = w.intents || {};
  const ikeys = Object.keys(intents);
  const policies = state.policyList || [];
  if (ikeys.length === 0 && policies.length === 0) {
    wf.appendChild(el('p', 'No intents or policies recorded yet.'));
  } else {
    const scroll = el('div'); scroll.className = 'scroll';
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label',
      'Intents and policies table'); scroll.setAttribute('tabindex', '0');
    const tbl = el('table');
    const thead = el('thead'); const trh = el('tr');
    trh.appendChild(el('th', 'Key')); trh.appendChild(el('th', 'Value'));
    trh.appendChild(el('th', 'Type')); thead.appendChild(trh); tbl.appendChild(thead);
    const tbody = el('tbody');
    for (const k of ikeys) {
      const tr = el('tr');
      tr.appendChild(el('td', k));
      const v = intents[k];
      const valStr = (typeof v === 'object') ? JSON.stringify(v) : String(v);
      tr.appendChild(el('td', valStr));
      tr.appendChild(el('td', 'intent'));
      tbody.appendChild(tr);
    }
    for (const p of policies) {
      const tr = el('tr');
      tr.appendChild(el('td', p.key));
      tr.appendChild(el('td', p.effect + (p.mutability === 'cemented' ? ' (cemented)' : '')));
      tr.appendChild(el('td', 'policy'));
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody); scroll.appendChild(tbl); wf.appendChild(scroll);
  }
  const wl = $('world-lore'); clear(wl);
  const lore = w.lore || {};
  const lkeys = Object.keys(lore);
  if (lkeys.length === 0) wl.appendChild(el('li', 'No lore yet.'));
  else for (const k of lkeys) {
    const l = lore[k];
    const li = el('li');
    li.appendChild(document.createTextNode(k + ': ' + statusWord(l.state)));
    if (l.provenance && l.provenance.source) {
      const d = el('details', null, {class: 'provenance'});
      d.appendChild(el('summary', 'provenance'));
      d.appendChild(el('p', 'source: ' + l.provenance.source +
        ' — ' + (l.provenance.observed_at || '').toString().slice(0, 16)));
      li.appendChild(d);
    }
    wl.appendChild(li);
  }
  const tbodyA = $('world-actors').querySelector('tbody'); clear(tbodyA);
  const acts = (state.actors && state.actors.data) || [];
  if (acts.length === 0) {
    const tr = el('tr'); const td = el('td', 'No providers connected — zero-provider boot is healthy by design.');
    td.setAttribute('colspan', '4'); tr.appendChild(td); tbodyA.appendChild(tr);
  } else {
    for (const a of acts) {
      const tr = el('tr');
      tr.appendChild(el('td', a.name || ''));
      tr.appendChild(el('td', a.role || ''));
      const td = el('td'); td.appendChild(chip(a.status)); tr.appendChild(td);
      tr.appendChild(el('td', a.writes || 'none'));
      tbodyA.appendChild(tr);
    }
  }
  const src = $('world-src'); clear(src);
  const sc = state.sourceControl;
  if (!sc || sc.ok === false) {
    const why = (sc && sc.warnings && sc.warnings[0]) || 'not configured';
    src.appendChild(el('p', 'Source control: ' + statusWord(sc && sc.status) + ' — ' + why));
  } else {
    const repos = (sc.data && sc.data.repos) || [];
    const ahead = repos.filter(r => (r.ahead || 0) > 0).length;
    const dirty = repos.filter(r => r.dirty).length;
    const behind = repos.filter(r => (r.behind || 0) > 0).length;
    src.appendChild(el('p', repos.length + ' repositories watched — ' +
      ahead + ' ahead of remote, ' + behind + ' behind, ' + dirty + ' with uncommitted changes.'));
    const tbl = el('table'); const thead = el('thead'); const trh = el('tr');
    for (const h of ['Repo', 'Branch', 'State', 'Last commit']) {
      trh.appendChild(el('th', h));
    }
    thead.appendChild(trh); tbl.appendChild(thead);
    const tbody = el('tbody');
    for (const r of repos) {
      const tr = el('tr');
      tr.appendChild(el('td', r.name));
      tr.appendChild(el('td', r.branch || '—'));
      const bits = [];
      if ((r.ahead || 0) > 0) bits.push('ahead ' + r.ahead);
      if ((r.behind || 0) > 0) bits.push('behind ' + r.behind);
      if (r.dirty) bits.push('uncommitted changes');
      if (!bits.length) bits.push('clean');
      tr.appendChild(el('td', bits.join(', ')));
      tr.appendChild(el('td', (r.last_commit_subject || '—') +
        ((r.last_commit_date || '').toString().slice(0, 10))));
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    const sc2 = el('div'); sc2.className = 'scroll'; sc2.setAttribute('role', 'region');
    sc2.setAttribute('aria-label', 'Repositories table'); sc2.setAttribute('tabindex', '0');
    sc2.appendChild(tbl); src.appendChild(sc2);
  }
  const up = $('world-updates'); clear(up);
  const upd = state.updates;
  if (!upd || upd.ok === false) {
    const why = (upd && upd.warnings && upd.warnings[0]) || 'not configured';
    up.appendChild(el('p', 'Updates: ' + statusWord(upd && upd.status) + ' — ' + why));
  } else {
    const d = upd.data || {};
    const checks = d.checks || {};
    const keys = Object.keys(checks);
    if (!keys.length) {
      up.appendChild(el('p', 'Update check ran; no tracked targets reported.'));
    } else {
      for (const k of keys) {
        const c = checks[k] || {};
        const line = k + ': ' + (c.current || 'unknown') +
          (c.available ? ' — update available: ' + c.available : ' — up to date');
        up.appendChild(el('p', line));
      }
    }
  }
}
/* ---- Journal ---- */
function renderJournal() {
  const ul = $('journal-list'); clear(ul);
  const events = (state.journal && state.journal.data) || [];
  const kind = state.journalFilter || '';
  const filtered = kind ? events.filter(e => e.kind === kind) : events;
  if (filtered.length === 0) {
    const msg = events.length === 0
      ? 'No journal entries yet. Entries appear as capabilities observe the world.'
      : 'No entries of this kind yet.';
    ul.appendChild(el('li', msg)); return;
  }
  for (const e of filtered.slice().reverse()) {
    const li = el('li');
    const t = el('time', (e.ts || '').toString().slice(0, 16).replace('T', ' '));
    li.appendChild(t); li.appendChild(document.createTextNode(' — '));
    li.appendChild(el('strong', e.kind));
    li.appendChild(document.createTextNode(': ' + e.summary));
    ul.appendChild(li);
  }
}
/* ---- Settings ---- */
function renderSettings() {
  const body = $('settings-body'); clear(body);
  const s = state.settings && state.settings.data;
  if (!s || (!s.capabilities && !s.packs && !s.policies)) {
    body.appendChild(el('p', 'No settings recorded yet.')); return;
  }
  const rows = [];
  for (const c of (s.capabilities || [])) {
    rows.push(['capability', c.key, c.description || '']);
  }
  for (const p of (s.policies || [])) {
    rows.push(['policy', p.key, p.effect + (p.mutability === 'cemented' ? ' (cemented)' : '')]);
  }
  for (const pk of (s.packs || [])) {
    rows.push(['pack', pk.key, pk.version || '']);
  }
  const scroll = el('div'); scroll.className = 'scroll';
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label',
    'Settings table'); scroll.setAttribute('tabindex', '0');
  const tbl = el('table');
  const thead = el('thead'); const trh = el('tr');
  trh.appendChild(el('th', 'Class')); trh.appendChild(el('th', 'Key'));
  trh.appendChild(el('th', 'Value')); thead.appendChild(trh); tbl.appendChild(thead);
  const tbody = el('tbody');
  for (const [cls, k, v] of rows) {
    const tr = el('tr');
    tr.appendChild(el('td', cls)); tr.appendChild(el('td', k));
    tr.appendChild(el('td', v)); tbody.appendChild(tr);
  }
  tbl.appendChild(tbody); scroll.appendChild(tbl); body.appendChild(scroll);
}
/* ---- Chat ---- */
async function sendChat() {
  const input = $('chat-input');
  const text = (input.value || '').trim();
  if (!text) return;
  if (!state.token) { setChatStatus('Enter your token first.', true); return; }
  const log = $('chat-log');
  const empty = $('chat-empty');
  if (empty) empty.remove();
  log.appendChild(el('div', text, {class: 'chat-msg user'}));
  input.value = '';
  $('chat-send').disabled = true;
  setChatStatus('Thinking… (local model — this can take a while on first reply)');
  const thinking = el('div', 'Checking your world…', {class: 'chat-msg assistant'});
  log.appendChild(thinking); log.scrollTop = log.scrollHeight;
  const res = await api(state.token, '/api/chat', {
    method: 'POST',
    body: JSON.stringify({message: text, history: state.chatHistory || []}),
  });
  $('chat-send').disabled = false;
  if (res.error) { thinking.remove(); setChatStatus('Chat failed: ' + res.error, true); return; }
  if (res.data && res.data.ok === false) {
    thinking.remove();
    const why = (res.data.warnings || []).join(' ');
    const err = el('div', 'AI is ' + statusWord(res.data.status) + '. ' + why +
      ' Everything else keeps working without it.', {class: 'chat-msg error'});
    log.appendChild(err);
    setChatStatus('AI unavailable — Personal World itself is unaffected.');
    return;
  }
  const reply = (res.data && res.data.data && res.data.data.reply) || '';
  thinking.remove();
  log.appendChild(el('div', reply, {class: 'chat-msg assistant'}));
  state.chatHistory = (state.chatHistory || []).concat(
    [{role: 'user', content: text}, {role: 'assistant', content: reply}]).slice(-6);
  setChatStatus('Replied ' + nowHHMM() + ' — from your local model with a read-only world snapshot.');
  log.scrollTop = log.scrollHeight;
}
function setChatStatus(t, isErr) {
  const s = $('chat-status');
  s.textContent = t;
  s.className = isErr ? '' : 'muted';
}
function renderAll() {
  renderToday(); renderWorld(); renderJournal(); renderSettings();
  buildSettingsPrefs(state.prefs || {});
  syncRoute();
}
async function load() {
  const token = $('token').value;
  setMsg('Loading…');
  let status, journal, daily, world, actors, settings, prefsRes, srcCtl, updates;
  try {
    // Promise.all needs an iterable; key the requests then reassemble.
    const requests = {
      status: api(token, '/api/status'),
      journal: api(token, '/api/journal?n=100'),
      daily: api(token, '/api/daily'),
      world: api(token, '/api/exports/world'),
      actors: api(token, '/api/actors'),
      settings: api(token, '/api/exports/settings'),
      prefsRes: api(token, '/api/prefs'),
      srcCtl: api(token, '/api/source-control/status'),
      updates: api(token, '/api/updates'),
    };
    const keys = Object.keys(requests);
    const settled = await Promise.all(keys.map(k => requests[k]));
    const results = Object.fromEntries(keys.map((k, i) => [k, settled[i]]));
    status = results.status; journal = results.journal; daily = results.daily;
    world = results.world; actors = results.actors; settings = results.settings;
    prefsRes = results.prefsRes; srcCtl = results.srcCtl; updates = results.updates;
  } catch (e) {
    setMsg('Personal World is unreachable — the core may be down.');
    return;
  }
  for (const v of [status, journal, daily, world, actors, settings]) {
    if (v && v.error === 'unauthorized') {
      setMsg('Authentication failed — check the token.'); return; }
    if (v && v.error === 'no_auth') {
      setMsg('Auth not configured on the server.'); return; }
    if (v && v.error) { setMsg('Personal World is unreachable — the core may be down.'); return; }
  }
  state.token = token;
  state.status = status.data;
  state.journal = journal.data;
  state.daily = daily.data;
  state.world = world.data;
  state.actors = actors.data;
  state.settings = settings.data;
  state.prefs = (prefsRes && prefsRes.data && prefsRes.data.data) || {};
  state.sourceControl = srcCtl;
  state.updates = updates;
  setMsg('Loaded ' + nowHHMM());
  $('login').setAttribute('hidden', '');
  renderAll();
}
const state = {};
function syncRoute() {
  const h = (location.hash || '#today').replace('#', '');
  const routes = ['today', 'chat', 'world', 'journal', 'settings'];
  const r = routes.includes(h) ? h : 'today';
  document.title = 'Personal World — ' + r[0].toUpperCase() + r.slice(1);
  for (const x of routes) {
    const v = $('view-' + x); if (v) v.classList.toggle('active', x === r);
  }
  for (const a of document.querySelectorAll('nav[aria-label="Main"] a')) {
    if (a.getAttribute('data-route') === r) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', syncRoute);
$('go').addEventListener('click', load);
$('token').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
$('chat-form').addEventListener('submit', e => { e.preventDefault(); sendChat(); });
for (const b of document.querySelectorAll('.jfilter')) {
  b.addEventListener('click', () => {
    for (const x of document.querySelectorAll('.jfilter')) x.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-pressed', 'true');
    state.journalFilter = b.getAttribute('data-kind');
    renderJournal();
  });
}
$('journal-more').addEventListener('click', async () => {
  if (!state.token) return;
  const res = await api(state.token, '/api/journal?n=500');
  if (!res.error) { state.journal = res.data; renderJournal();
    setMsg('Loaded up to 500 journal entries — ' + nowHHMM()); }
});
syncRoute();
</script>
</body>
</html>
"""
