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
        # itself is inert without a valid token.
        return DASHBOARD_HTML

    return app


DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World — Today</title>
<style>
:root { color-scheme: dark; --bg:#0e0d12; --text:#d8d4cc; --border:#2a2731;
        --panel:#16151b; --muted:#9a958c; }
@media (prefers-color-scheme: light) {
  :root { color-scheme: light; --bg:#f4f2ed; --text:#26241f; --border:#d9d4c9;
          --panel:#ece9e1; --muted:#6b675f; }
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif;
       margin: 0; padding: 1.5rem; line-height: 1.6; max-width: 100%; }
.wrap { max-width: 48rem; margin: 0 auto; }
h1 { font-size: 1.3rem; margin: 0 0 1rem; }
h2 { font-size: 1.05rem; margin: 1.5rem 0 0.5rem; color: var(--text); }
section { margin-bottom: 1.5rem; }
p { margin: 0.5rem 0; }
ul { margin: 0.5rem 0; padding-left: 1.25rem; }
li { margin: 0.25rem 0; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0;
        font-size: 0.95rem; }
th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border);
         overflow-wrap: anywhere; }
th { color: var(--muted); font-weight: 500; }
.scroll { overflow-x: auto; }
code { background: var(--panel); padding: 0.1rem 0.3rem; border-radius: 4px;
       overflow-wrap: anywhere; }
header.banner { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;
                padding-bottom: 1rem; border-bottom: 1px solid var(--border);
                margin-bottom: 1rem; }
nav[aria-label="Main"] { display: flex; gap: 0.25rem; flex-wrap: wrap; }
nav[aria-label="Main"] a { display: inline-flex; align-items: center;
                           padding: 0.55rem 0.9rem; min-width: 44px; min-height: 44px;
                           color: var(--text); text-decoration: none;
                           border: 1px solid var(--border); border-radius: 6px;
                           background: var(--panel); }
nav[aria-label="Main"] a[aria-current="page"] { border-color: var(--text); }
#login { display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap; }
input { background: var(--panel); color: var(--text); border: 1px solid var(--border);
        border-radius: 6px; padding: 0.55rem; font-size: 1rem;
        min-width: 44px; min-height: 44px; }
button { background: var(--panel); color: var(--text); border: 1px solid var(--border);
         border-radius: 6px; padding: 0.55rem 1rem; font-size: 1rem;
         min-width: 44px; min-height: 44px; cursor: pointer; }
.skip { position: absolute; left: -9999px; top: auto; }
.skip:focus { left: 1rem; top: 1rem; background: var(--panel);
              padding: 0.5rem; border: 1px solid var(--text); z-index: 10; }
:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.muted { color: var(--muted); }
#msg { color: var(--muted); }
.view { display: none; }
.view.active { display: block; }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>
<a class="skip" href="#main-content">Skip to main content</a>
<div class="wrap">
<header class="banner">
<h1 id="brand">Personal World</h1>
<nav aria-label="Main">
<a href="#today" data-route="today">Today</a>
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
<h2 id="today-h1">Today</h2>
<section aria-labelledby="today-health-h2">
<h2 id="today-health-h2">Overall health</h2>
<div id="today-health" class="muted">Loading…</div>
</section>
<section aria-labelledby="today-attention-h2">
<h2 id="today-attention-h2">Needs attention</h2>
<ul id="today-attention"><li class="muted">Loading…</li></ul>
</section>
<section aria-labelledby="today-caps-h2">
<h2 id="today-caps-h2">Capabilities</h2>
<div class="scroll" role="region" aria-label="Capabilities table" tabindex="0">
<table id="today-caps"><thead><tr><th>Area</th><th>Status</th></tr></thead>
<tbody><tr><td colspan="2" class="muted">Loading…</td></tr></tbody></table>
</div>
</section>
<section aria-labelledby="today-journal-h2">
<h2 id="today-journal-h2">Recent journal</h2>
<ul id="today-journal"><li class="muted">Loading…</li></ul>
<p><a href="#journal">View all</a></p>
</section>
</section>
<section id="view-world" class="view" aria-labelledby="world-h1">
<h2 id="world-h1">World</h2>
<section aria-labelledby="world-facts-h2">
<h2 id="world-facts-h2">Facts &amp; intent</h2>
<div id="world-facts" class="muted">Loading…</div>
</section>
<section aria-labelledby="world-lore-h2">
<h2 id="world-lore-h2">Lore</h2>
<ul id="world-lore"><li class="muted">Loading…</li></ul>
</section>
<section aria-labelledby="world-actors-h2">
<h2 id="world-actors-h2">Actors</h2>
<div class="scroll" role="region" aria-label="Actors table" tabindex="0">
<table id="world-actors"><thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
<tbody><tr><td colspan="3" class="muted">Loading…</td></tr></tbody></table>
</div>
</section>
</section>
<section id="view-journal" class="view" aria-labelledby="journal-h1">
<h2 id="journal-h1">Journal</h2>
<ul id="journal-list"><li class="muted">Loading…</li></ul>
</section>
<section id="view-settings" class="view" aria-labelledby="settings-h1">
<h2 id="settings-h1">Settings</h2>
<p class="muted">Settings export is whitelist-based; private and secret material never appears here.</p>
<div id="settings-body" class="muted">Loading…</div>
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
  if (t === 'unknown') return 'unknown';
  if (t === 'not_configured') return 'not configured';
  return t;
}
async function api(token, path) {
  const r = await fetch(path, {headers: {'Authorization': 'Bearer ' + token}});
  if (r.status === 401) return {error: 'unauthorized'};
  if (r.status === 503) return {error: 'no_auth'};
  if (!r.ok) return {error: 'http_' + r.status};
  return {data: await r.json()};
}
function rankStatus(s) {
  const order = {'unavailable': 3, 'unhealthy': 2, 'not configured': 2,
                 'unknown': 1, 'healthy': 0};
  return order[String(s).toLowerCase()] != null
    ? order[String(s).toLowerCase()] : 0;
}
async function load() {
  const token = $('token').value;
  setMsg('Loading…');
  let status, journal, daily, world, actors, settings;
  try {
    ({status, journal, daily, world, actors, settings} = await Promise.all({
      status: api(token, '/api/status'),
      journal: api(token, '/api/journal?n=20'),
      daily: api(token, '/api/daily'),
      world: api(token, '/api/exports/world'),
      actors: api(token, '/api/actors'),
      settings: api(token, '/api/exports/settings'),
    }).then(o => ({
      status: o.status, journal: o.journal, daily: o.daily,
      world: o.world, actors: o.actors, settings: o.settings,
    })));
  } catch (e) {
    setMsg('Personal World is unreachable — the core may be down.');
    return;
  }
  for (const [k, v] of [['status',status],['journal',journal],['daily',daily],
       ['world',world],['actors',actors],['settings',settings]]) {
    if (v && v.error === 'unauthorized') {
      setMsg('Authentication failed — check the token.'); return; }
    if (v && v.error === 'no_auth') {
      setMsg('Auth not configured on the server.'); return; }
    if (v && v.error) { setMsg('Personal World is unreachable — the core may be down.'); return; }
  }
  state.status = status.data;
  state.journal = journal.data;
  state.daily = daily.data;
  state.world = world.data;
  state.actors = actors.data;
  state.settings = settings.data;
  setMsg('Loaded ' + nowHHMM());
  $('login').setAttribute('hidden', '');
  renderAll();
}
function renderAll() {
  renderToday(); renderWorld(); renderJournal(); renderSettings(); syncRoute();
}
function renderToday() {
  const caps = (state.status && state.status.data && state.status.data.capabilities) || {};
  const capKeys = Object.keys(caps);
  const healthy = capKeys.filter(k => caps[k].status === 'healthy').length;
  const total = capKeys.length;
  const worst = capKeys.map(k => statusWord(caps[k].status))
    .sort((a, b) => rankStatus(b) - rankStatus(a))[0] || 'unknown';
  const healthDiv = $('today-health');
  clear(healthDiv);
  if (total === 0 || healthy === total) {
    healthDiv.appendChild(el('p', 'Worst capability status: ' + worst + '. ' +
      healthy + ' healthy of ' + total + '.'));
  } else {
    healthDiv.appendChild(el('p', 'Worst capability status: ' + worst + '. ' +
      healthy + ' healthy of ' + total + '.'));
  }
  const att = $('today-attention'); clear(att);
  const items = (state.daily && state.daily.data && state.daily.data.attention) || [];
  if (items.length === 0) {
    att.appendChild(el('li', 'Nothing needs your attention.'));
  } else {
    for (const a of items) att.appendChild(el('li', a));
  }
  const tbody = $('today-caps').querySelector('tbody'); clear(tbody);
  if (capKeys.length === 0) {
    const tr = el('tr'); const td = el('td', 'No providers connected yet.');
    td.setAttribute('colspan', '2'); tr.appendChild(td); tbody.appendChild(tr);
  } else {
    for (const k of capKeys) {
      const tr = el('tr');
      tr.appendChild(el('td', k));
      tr.appendChild(el('td', statusWord(caps[k].status)));
      tbody.appendChild(tr);
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
function renderWorld() {
  const wf = $('world-facts'); clear(wf);
  const w = state.world && state.world.data || {};
  const intents = w.intents || {};
  const facts = w.policies || {};
  const pairs = [];
  for (const k in intents) pairs.push([k, intents[k], 'intent']);
  const keys = Object.keys(pairs);
  if (keys.length === 0 && Object.keys(w.lore || {}).length === 0 && keys.length === 0) {
    wf.appendChild(el('p', 'World is empty — no facts or intents recorded yet.'));
  } else if (keys.length === 0) {
    wf.appendChild(el('p', 'World is empty — no facts or intents recorded yet.'));
  } else {
    const scroll = el('div'); scroll.className = 'scroll';
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label',
      'Facts and intents table'); scroll.setAttribute('tabindex', '0');
    const tbl = el('table');
    const thead = el('thead'); const trh = el('tr');
    trh.appendChild(el('th', 'Key')); trh.appendChild(el('th', 'Value'));
    trh.appendChild(el('th', 'Class')); thead.appendChild(trh); tbl.appendChild(thead);
    const tbody = el('tbody');
    for (const [k, v, cls] of pairs) {
      const tr = el('tr');
      tr.appendChild(el('td', k));
      const valStr = (typeof v === 'object') ? JSON.stringify(v) : String(v);
      tr.appendChild(el('td', valStr));
      tr.appendChild(el('td', cls));
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
    wl.appendChild(li);
  }
  const tbodyA = $('world-actors').querySelector('tbody'); clear(tbodyA);
  const acts = (state.actors && state.actors.data) || [];
  if (acts.length === 0) {
    const tr = el('tr'); const td = el('td', 'No actors registered.');
    td.setAttribute('colspan', '3'); tr.appendChild(td); tbodyA.appendChild(tr);
  } else {
    for (const a of acts) {
      const tr = el('tr');
      tr.appendChild(el('td', a.name || ''));
      tr.appendChild(el('td', a.role || ''));
      tr.appendChild(el('td', statusWord(a.status)));
      tbodyA.appendChild(tr);
    }
  }
}
function renderJournal() {
  const ul = $('journal-list'); clear(ul);
  const events = (state.journal && state.journal.data) || [];
  if (events.length === 0) {
    ul.appendChild(el('li', 'No journal entries yet.')); return;
  }
  for (const e of events.slice().reverse()) {
    const li = el('li');
    const t = el('time', (e.ts || '').toString().slice(0, 16).replace('T', ' '));
    li.appendChild(t); li.appendChild(document.createTextNode(' — '));
    li.appendChild(document.createTextNode(e.kind + ': ' + e.summary));
    ul.appendChild(li);
  }
}
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
const state = {};
function syncRoute() {
  const h = (location.hash || '#today').replace('#', '');
  const routes = ['today', 'world', 'journal', 'settings'];
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
syncRoute();
</script>
</body>
</html>
"""