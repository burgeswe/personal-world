"""Secure API. One core; CLI, dashboard, and AI tools all consume it.

Auth: bearer token (private-notes Pattern C). Fail-closed: no token
configured -> protected routes 503; wrong token -> 401. The token is
compared with hmac.compare_digest and never logged.
"""

import hmac
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse

from . import export
from .app import build_registry, load_world, save_world
from .envelope import Result
from .journal import AuditRenderer, Journal
from .loop import daily
from .providers.registry import Registry
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

    @app.get("/api/actors", dependencies=[Depends(require_auth)])
    async def actors() -> dict:
        _, registry = _state()
        return {
            "ok": True,
            "data": [a.model_dump(mode="json") for a in registry.actors()],
        }

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

    @app.get("/", response_class=HTMLResponse)
    async def dashboard() -> HTMLResponse:
        # Dashboard shell: static HTML that fetches /api/* with the
        # session's token. Auth is enforced per API call; the shell
        # itself is inert without a valid token.
        return DASHBOARD_HTML

    return app


DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World</title>
<style>
:root { color-scheme: dark; }
body { background: #0e0d12; color: #d8d4cc; font-family: system-ui, sans-serif;
       margin: 0; padding: 1.5rem; line-height: 1.6; }
main { max-width: 48rem; margin: 0 auto; }
h1 { font-size: 1.3rem; color: #d8d4cc; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #2a2731;
         font-size: 0.95rem; }
th { color: #9a958c; font-weight: 500; }
#login { display: flex; gap: 0.5rem; margin: 1rem 0; }
input { background: #16151b; color: #d8d4cc; border: 1px solid #2a2731;
        border-radius: 6px; padding: 0.55rem; font-size: 1rem; min-width: 44px; min-height: 44px; }
button { background: #2a2731; color: #d8d4cc; border: 1px solid #3a3741;
         border-radius: 6px; padding: 0.55rem 1rem; font-size: 1rem;
         min-width: 44px; min-height: 44px; cursor: pointer; }
code { background: #16151b; padding: 0.1rem 0.3rem; border-radius: 4px; }
#msg { color: #9a958c; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<main>
<h1>Personal World</h1>
<div id="login">
<input id="token" type="password" placeholder="API token" aria-label="API token">
<button id="go">Show my world</button>
</div>
<p id="msg">Token stays in this browser; requests go to /api/*.</p>
<div id="content"></div>
<script>
const el = id => document.getElementById(id);
async function load() {
  const token = el('token').value;
  const h = {'Authorization': 'Bearer ' + token};
  const content = el('content');
  try {
    const [st, jr] = await Promise.all([
      fetch('/api/status', {headers: h}).then(r => r.ok ? r.json() : null),
      fetch('/api/journal?n=10', {headers: h}).then(r => r.ok ? r.json() : null),
    ]);
    if (!st) { el('msg').textContent = 'Authentication failed or auth not configured.'; return; }
    el('msg').textContent = '';
    const d = st.data;
    let html = '<table><tr><th>Area</th><th>State</th></tr>';
    for (const [k, v] of Object.entries(d.capabilities || {}))
      html += `<tr><td>${k}</td><td>${v.status}</td></tr>`;
    html += '</table>';
    const events = (jr && jr.data) || [];
    html += '<h2 style="font-size:1.05rem">Recent journal</h2><ul>';
    for (const e of events.slice(-10))
      html += `<li>${e.kind}: ${e.summary}</li>`;
    html += '</ul>';
    content.innerHTML = html;
  } catch (e) { el('msg').textContent = 'Error: ' + e; }
}
el('go').addEventListener('click', load);
el('token').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
</script>
</main>
</body>
</html>
"""