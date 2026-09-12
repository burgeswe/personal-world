"""Secure API. One core; CLI, dashboard, and AI tools all consume it.

Auth: bearer token (private-notes Pattern C). Fail-closed: no token
configured -> protected routes 503; wrong token -> 401. The token is
compared with hmac.compare_digest and never logged.
"""

import hmac
import json
import secrets
import datetime
import os
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, FileResponse
from starlette.concurrency import run_in_threadpool

from . import export, prefs
from . import sections as sections_mod
from .app import build_registry, load_world, save_world
from .chat import chat_once, build_chat_messages
from .chat_context import build_world_context, build_ui_context
from .envelope import Result
from .journal import AuditRenderer, Journal
from .loop import daily
from .providers.lab_state import DEFAULT_LAB, LabState
from .providers.registry import Registry
from .source_control import (
    discover_repositories,
    repository_history,
    status_all,
)
from .world import MutationDenied, World

WIZARD_HTML = """

<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World — Setup wizard</title>
<meta name="theme-color" content="#0a0810">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/companions/personal-world.svg">
<style>
@font-face { font-family: "Young Serif"; src: url("/fonts/young-serif-latin.woff2") format("woff2"); }
@font-face { font-family: "Instrument Sans"; src: url("/fonts/instrument-sans-var-latin.woff2") format("woff2"); }
:root { color-scheme: dark; --bg: #0a0810; --panel: #12101a; --border: #2a2538;
  --text: #f0eaff; --muted: #8a7ba3; --accent: #72b1b1; --ok: #5fb85f;
  --warn: #d4a54c; --err: #d4644c; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: "Instrument Sans", system-ui, sans-serif;
  margin: 0; min-height: 100vh; display: flex; align-items: center;
  justify-content: center; padding: 1rem; }
.wizard { background: var(--panel); border: 1px solid var(--border);
  border-radius: 12px; padding: 2rem; max-width: 520px; width: 100%; }
h1 { font-family: "Young Serif", system-ui, serif; font-size: 1.4rem; margin: 0 0 0.25rem; color: var(--accent); }
.step-label { color: var(--muted); font-size: 0.85rem; margin-bottom: 1rem;
  letter-spacing: 0.05em; }
.big { font-size: 1.08rem; line-height: 1.5; color: var(--text); margin: 1rem 0; }
.hint { color: var(--muted); font-size: 0.88rem; line-height: 1.45; margin-top: 0.4rem; }
label { display: block; margin: 1.2rem 0 0.3rem; font-size: 0.92rem; }
input[type="text"], input[type="password"] { width: 100%; background: var(--bg);
  color: var(--text); border: 2px solid var(--border); border-radius: 8px;
  padding: 0.7rem; font-size: 1.05rem; min-height: 48px; }
input:focus { border-color: var(--accent); outline: none; }
.companions { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem; margin-top: 1rem; }
.comp-btn { background: var(--bg); border: 2px solid var(--border); color: var(--text);
  border-radius: 10px; padding: 0.9rem 0.5rem; font-size: 0.98rem; min-height: 56px;
  cursor: pointer; text-align: center; width: 100%; }
.comp-btn.selected { border-color: var(--accent); background: #1a2a2a; }
.nav { display: flex; gap: 0.75rem; margin-top: 2rem; }
.nav button { flex: 1; padding: 0.8rem 1rem; font-size: 1rem; font-weight: 600;
  border-radius: 8px; border: none; cursor: pointer; min-height: 48px; }
.nav .back { background: transparent; color: var(--muted); border: 1px solid var(--border); }
.nav .next { background: var(--accent); color: var(--bg); }
.nav button:disabled { opacity: 0.4; cursor: not-allowed; }
.step { display: none; }
.step.active { display: block; }
.summary-row { display: flex; justify-content: space-between; padding: 0.55rem 0;
  border-bottom: 1px solid var(--border); font-size: 0.95rem; }
.summary-row .v { color: var(--accent); }
.msg { margin-top: 1rem; font-size: 0.9rem; min-height: 1.2em; color: var(--muted); }
.msg.ok { color: var(--ok); }
.msg.err { color: var(--err); }
a.finish { color: var(--accent); }
.composer { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.composer input { flex: 1 1 260px; min-height: 48px; background: var(--panel); color: var(--text, #f2eefa); border: 1px solid var(--border); border-radius: 10px; padding: 0 14px; font: inherit; }
.composer button { min-height: 48px; min-width: 88px; border-radius: 10px; border: 1px solid var(--border); background: var(--panel); color: inherit; font: inherit; }
.composer-templates { display: flex; gap: 8px; margin-top: 8px; }
.chip-btn { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel); color: inherit; font: inherit; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
</head>
<body>
<div class="wizard">
<h1>Welcome to your Personal World</h1>
<div id="steplabel" class="step-label">Step 1 of 5</div>

<div class="step active" data-step="1">
  <div class="big">What would you like to call this world?</div>
  <div class="hint">Just a friendly name. You can change it later in the
  dashboard. Leave it blank and we'll use "My Personal World".</div>
  <input id="w-name" type="text" maxlength="60" autocomplete="off"
         placeholder="My Personal World">
</div>

<div class="step" data-step="2">
  <div class="big">Pick your companion.</div>
  <div class="hint">A little face that lives in the dashboard with you. You can
  change it any time.</div>
  <div class="companions" role="radiogroup" aria-label="Companion">
    <button type="button" class="comp-btn selected" aria-pressed="true" data-c="personal-world">World Keeper</button>
    <button type="button" class="comp-btn" aria-pressed="false" data-c="mermaid">Mermaid</button>
    <button type="button" class="comp-btn" aria-pressed="false" data-c="robot">Robot</button>
    <button type="button" class="comp-btn" aria-pressed="false" data-c="world-tree-squirrel">Tree Squirrel</button>
    <button type="button" class="comp-btn" aria-pressed="false" data-c="taco-news-truck">Taco Truck</button>
  </div>
</div>

<div class="step" data-step="3">
  <div class="big">Choose your login token.</div>
  <div class="hint">This is the password for the dashboard. At least 8
  characters. You can also press Generate and let us make a strong one
  for you — then copy it somewhere safe (like a password manager).</div>
  <label for="w-token">Login token</label>
  <input id="w-token" type="password" autocomplete="off">
  <div style="display:flex; gap: 0.5rem; margin-top: 0.6rem;">
    <button type="button" id="gen" style="background: transparent;
      color: var(--accent); border: 1px solid var(--border); border-radius: 8px;
      min-height: 44px; padding: 0.5rem 1rem; cursor: pointer;">Generate</button>
    <button type="button" id="show" style="background: transparent;
      color: var(--muted); border: 1px solid var(--border); border-radius: 8px;
      min-height: 44px; padding: 0.5rem 1rem; cursor: pointer;">Show</button>
  </div>
  <div class="msg" id="tok-msg"></div>
</div>

<div class="step" data-step="4">
  <div class="big">Optional: vault passphrase.</div>
  <div class="hint">The vault keeps secrets encrypted. A passphrase here is
  like a second key — you would use it every time you open the vault.
  Totally fine to skip this now and add it later in Settings.</div>
  <label for="v1">Vault passphrase (optional)</label>
  <input id="v1" type="password" autocomplete="off">
  <label for="v2">Confirm</label>
  <input id="v2" type="password" autocomplete="off">
</div>

<div class="step" data-step="5">
  <div class="big">Ready. Here's what we'll set up:</div>
  <div class="summary-row"><span>World name</span>
    <span class="v" id="sum-name"></span></div>
  <div class="summary-row"><span>Companion</span>
    <span class="v" id="sum-comp"></span></div>
  <div class="summary-row"><span>Login token</span>
    <span class="v" id="sum-tok"></span></div>
  <div class="summary-row"><span>Vault passphrase</span>
    <span class="v" id="sum-pv"></span></div>
  <div class="hint" style="margin-top:1rem">Press Finish and your world
  starts.</div>
</div>

<div class="nav">
  <button type="button" class="back" id="back-btn" disabled>Back</button>
  <button type="button" id="next-btn">Next</button>
</div>
<div class="msg" id="finish-msg"></div>
</div>

<script>
const state = { step: 1, name: "", comp: "personal-world", token: "", pass: "" };
const TOTAL = 5;
function $(id) { return document.getElementById(id); }
function label() { $("steplabel").textContent = "Step " + state.step + " of " + TOTAL; }
function show(n) {
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  document.querySelector('[data-step="' + n + '"]').classList.add("active");
  state.step = n; label();
  $("back-btn").disabled = (n === 1);
  $("next-btn").textContent = (n === TOTAL) ? "Finish" : "Next";
}
$("back-btn").addEventListener("click", () => { if (state.step > 1) show(state.step - 1); });
$("next-btn").addEventListener("click", async () => {
  if (state.step === 1) { state.name = $("w-name").value.trim(); show(2); return; }
  if (state.step === 3) {
    state.token = $("w-token").value;
    if (state.token.length < 8) { $("tok-msg").textContent = "At least 8 characters, or press Generate."; return; }
    $("tok-msg").textContent = "";
  }
  if (state.step === 4) {
    const p1 = $("v1").value, p2 = $("v2").value;
    if (p1 || p2) { if (p1 !== p2) { $("finish-msg").textContent = "Passphrases do not match."; return; } state.pass = p1; }
    else state.pass = "";
    $("sum-name").textContent = state.name || "My Personal World";
    $("sum-comp").textContent = state.comp;
    $("sum-tok").textContent = "(" + state.token.length + " characters)";
    $("sum-pv").textContent = state.pass ? "set" : "skipped for now";
    show(5); return;
  }
  // Step 5 → finish
  const btn = $("next-btn"); btn.disabled = true;
  $("finish-msg").className = "msg"; $("finish-msg").textContent = "Setting up your world…";
  try {
    const r = await fetch("/api/setup", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.token, vault_passphrase: state.pass }) });
    if (!r.ok) { const j = await r.json().catch(() => ({}));
      $("finish-msg").textContent = j.detail || "Setup failed.";
      $("finish-msg").className = "msg err"; btn.disabled = false; return; }
    try {
      await fetch("/api/prefs", { method: "PUT",
        headers: { "Content-Type": "application/json",
          "Authorization": "Bearer " + state.token },
        body: JSON.stringify({ companion: state.comp }) });
    } catch (e) { /* companion pref is cosmetic; never block setup */ }
    localStorage.setItem("pw-token", state.token);
    // Persist the world name as an instance fact (canonical key "world.name"),
    // default "My Personal World" if left blank.
    try {
      const nm = state.name || "My Personal World";
      await fetch("/api/world/fact", { method: "POST",
        headers: { "Content-Type": "application/json",
          "Authorization": "Bearer " + state.token },
        body: JSON.stringify({ key: "world.name", value: nm }) });
    } catch (e) { /* name persists after next login if the write races */ }
    $("finish-msg").textContent = "Your world is ready. Opening the dashboard…";
    $("finish-msg").className = "msg ok";
    setTimeout(() => { window.location.href = "/"; }, 1200);
  } catch (e) {
    $("finish-msg").textContent = "Connection failed: " + e.message;
    $("finish-msg").className = "msg err";
    btn.disabled = false;
  }
});
document.querySelectorAll(".comp-btn").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".comp-btn").forEach(x => { x.classList.remove("selected"); x.setAttribute("aria-pressed","false"); });
  b.classList.add("selected"); b.setAttribute("aria-pressed","true"); state.comp = b.getAttribute("data-c");
}));
$("gen").addEventListener("click", () => {
  const g = Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(x => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 58]).join("");
  $("w-token").value = g; $("w-token").setAttribute("type", "text");
  state.token = g;
  $("tok-msg").textContent = "Strong token generated. Copy it somewhere safe.";
  $("tok-msg").className = "msg ok";
});
$("show").addEventListener("click", () => {
  const t = $("w-token");
  t.setAttribute("type", t.getAttribute("type") === "password" ? "text" : "password");
});
show(1);
</script>
</body>
</html>
"""


def _token() -> str | None:
    return os.environ.get("PW_API_TOKEN")


def _step_up_authorized(request: Request) -> bool:
    """Write path semantics. Loopback OR non-forwarded Header X-PW-StepUp: 1.

    Loopback in Docker bridge mode passes automatically (mirrors the
    vault GET). External requests must send the step-up header
    (step-up login keeps sessions) - documented contract; consumers
    that need to write from remote browsers add `X-PW-StepUp: 1` when
    they're past Authelia."""
    client = request.client.host if request.client else "?"
    if client in ("127.0.0.1", "::1", "localhost", "testclient"):
        return True
    if request.headers.get("X-PW-StepUp") == "1":
        return True
    import ipaddress as _ipa
    try:
        ip = _ipa.ip_address(client)
    except ValueError:
        ip = None
    if ip is not None and (ip.is_loopback or ip.is_private):
        return True
    return False


async def require_step_up(request: Request) -> None:
    await require_auth(request)
    if not _step_up_authorized(request):
        raise HTTPException(
            status_code=403, detail="write requires step-up auth")


async def require_auth(request: Request) -> None:
    """Gate + principal resolution (the single seam).

    On success the resolved principal lands on request.state.principal
    for sub-dependencies and handlers. In "single" mode the bootstrap
    "primary" person is the only principal; "multi" resolves hashed
    user tokens from the local identity store.
    """
    from .identity import resolve_principal, NoPrincipalError
    uma = getattr(request.app.state, "identity", None)
    token = _token()
    if not token:
        raise HTTPException(status_code=503, detail="auth not configured")
    header = request.headers.get("Authorization", "")
    supplied = header.removeprefix("Bearer ").strip()
    if not supplied:
        raise HTTPException(status_code=401, detail="unauthorized")
    identity = getattr(request.app.state, "identity", None)
    mode = identity["mode"] if identity else "single"
    store = identity["store"] if identity else None
    try:
        principal = resolve_principal(supplied, store, mode, token)
    except NoPrincipalError:
        raise HTTPException(status_code=401, detail="unauthorized")
    request.state.principal = principal


def create_app(data_dir: Path | None = None, config_dir: Path | None = None) -> FastAPI:
    data_dir = Path(data_dir or os.environ.get("PW_DATA_DIR", "./data"))
    config_dir = Path(config_dir or os.environ.get("PW_CONFIG_DIR", "./config"))
    # Serving boundary (P1 T3): "legacy" (default) serves the built-in
    # HTML pages; "react" serves frontend/dist as an SPA. Dist is never
    # echoed into a browser response — private paths stay private.
    frontend_mode = os.environ.get("PW_FRONTEND", "legacy").strip().lower()
    if frontend_mode not in ("legacy", "react"):
        frontend_mode = "legacy"
    frontend_dist = Path(os.environ.get("PW_FRONTEND_DIST") or
                         (Path(__file__).resolve().parents[2] / "frontend" / "dist"))

    def _spa_index() -> HTMLResponse:
        index = frontend_dist / "index.html"
        if index.is_file():
            return HTMLResponse(index.read_text(encoding="utf-8"),
                                headers={"Cache-Control": "no-cache"})
        return HTMLResponse(
            SPA_NOT_BUILT_HTML,
            status_code=503,
            headers={"Cache-Control": "no-store"},
        )

    # Identity seam state (issue #8 phase 0/1, per multi-user review
    # 2026-09-09): local users as trust root, PW_IDENTITY_MODE picks
    # single (bootstrap-primary bypass) or multi (hashed-token users).
    from .identity import IdentityStore
    _identity_mode = os.environ.get("PW_IDENTITY_MODE", "single")
    _identity_store = IdentityStore(data_dir)
    _app_instance_token = _token()
    world_path = data_dir / "world.json"
    journal = Journal(data_dir / "journal.ndjson")

    from .model import JournalKind
    app = FastAPI(title="Personal World", version="0.2.0")
    # issue #8, phase 0: the identity seam state lives on app.state so
    # single-mode behavior is byte-identical and multi-mode lights up
    # without changing how the client calls the API.
    # Multi-mode bootstrap: the instance token remains the primary
    # person's credential so enabling multi mode never locks the
    # operator out. First-run in multi continues to work.
    if _identity_mode == "multi":
        try:
            _identity_store.legacy_primary(_token())
        except Exception:
            pass

    app.state.identity = {"mode": _identity_mode,
                          "store": _identity_store,
                          "instance_token": _app_instance_token}
    app.state.frontend_mode = frontend_mode
    app.state.frontend_dist = frontend_dist

    # --- Setup & Login ---

    @app.get("/healthz")
    async def healthz() -> dict:
        token = _token()
        setup_needed = not (data_dir / "setup-complete").exists()
        return {
            "ok": True,
            "auth_configured": token is not None,
            "setup_needed": setup_needed,
        }

    @app.get("/api/setup/status")
    async def setup_status() -> dict:
        """Check if first-run setup is needed."""
        complete = (data_dir / "setup-complete").exists()
        return {"ok": True, "data": {"complete": complete}}

    @app.post("/api/setup")
    async def setup(request: Request) -> dict:
        """First-run setup: create API token and vault passphrase."""
        if (data_dir / "setup-complete").exists():
            raise HTTPException(status_code=409, detail="setup already complete")
        body = await request.json()
        token = body.get("token", "").strip()
        if not token or len(token) < 8:
            raise HTTPException(status_code=400, detail="token must be >= 8 chars")
        # Write token to env file for the container to pick up
        env_path = data_dir / ".env"
        env_path.write_text(f"PW_API_TOKEN={token}\n")
        # Also set in current process so it works immediately
        os.environ["PW_API_TOKEN"] = token
        # Mark setup complete
        (data_dir / "setup-complete").write_text("ok")
        # Initialize vault if passphrase provided
        vault_pass = body.get("vault_passphrase", "").strip()
        if vault_pass:
            _vault.unlock(vault_pass)
            _vault._save()  # write the encrypted file immediately
        return {"ok": True, "data": {"token_set": True, "vault_initialized": bool(vault_pass)}}

    def _state() -> tuple[World, Registry]:
        world = load_world(world_path)
        registry = build_registry(world, Registry(), config_dir)
        return world, registry

    def _principal(request: Request):
        from .identity import Principal
        return getattr(request.state, 'principal', None)

    def _user_paths(request: Request) -> tuple[Path, Path]:
        """Per-user world/journal paths for the caller (multi mode).

        Returns the _global_ paths in single mode: the bootstrap
        person's state remains the instance state until multi mode is
        enabled (PW_IDENTITY_MODE multi), keeping single-user behavior
        byte-identical.
        """
        identity = getattr(request.app.state, 'identity', {})
        if identity.get('mode') != 'multi':
            return world_path, journal.path
        from .user import User
        principal = getattr(request.state, 'principal', None)
        if principal is None:
            raise HTTPException(status_code=409,
                                detail='principal not resolved')
        user = User(id=principal.id, name=principal.id, root=data_dir)
        return user.world_path, user.journal_path

    def _state_for(request: Request) -> tuple[World, Registry, Path]:
        """World + registry + the caller's own journal. Multi mode
        loads the caller-person's tree; single mode uses the
        bootstrap-shared paths (byte-identical legacy behavior)."""
        uw, uj = _user_paths(request)
        world = load_world(uw)
        registry = build_registry(world, Registry(), config_dir)
        return world, registry, uj

    @app.get("/api/status", dependencies=[Depends(require_auth)])
    async def status() -> dict:
        world, registry = _state()
        s = world.summary()
        s["capabilities"] = registry.status_map()
        s["actors"] = [a.model_dump(mode="json") for a in registry.actors()]
        return {"ok": True, "status": "healthy", "data": s}

    @app.get("/api/daily", dependencies=[Depends(require_auth)])
    async def daily_view() -> dict:
        """Present the daily digest. Read-only: a page view never
        journals observations or records facts (that is the POST)."""
        world, registry = _state()
        result = daily(world, registry, journal, record=False)
        return result.model_dump(mode="json")

    @app.post("/api/daily", dependencies=[Depends(require_auth)])
    async def daily_run() -> dict:
        """Run the daily loop for real: journal observations, record
        capability facts, flag drift, save the world."""
        world, registry = _state()
        result = daily(world, registry, journal, record=True)
        save_world(world, world_path)
        return result.model_dump(mode="json")

    @app.get("/api/journal", dependencies=[Depends(require_auth)])
    async def journal_view(request: Request, n: int = 20) -> dict:
        _require_person(getattr(request.state, "principal", None))
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        events = target.recent(n)
        return {"ok": True,
                "data": [e.model_dump(mode="json") for e in events]}

    @app.post("/api/journal", dependencies=[Depends(require_auth)])
    async def journal_note(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        """Write a personal note to the caller's own journal.

        Body: {"text": "<1-2000 chars>"}. Stored when the user is in
        multi mode; shared journal in single mode.
        """
        body = await request.json()
        text = (body or {}).get("text", "").strip()
        if not text or len(text) > 2000:
            raise HTTPException(status_code=422, detail="text must be 1-2000 chars")
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        target.record(kind=JournalKind.OBSERVATION, summary=text, source="user")
        return {"ok": True, "data": {"written": len(text)}}

    @app.get("/api/journal/audit", dependencies=[Depends(require_auth)])
    async def journal_audit(request: Request) -> dict:
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        return {"ok": True, "data": {"text": AuditRenderer().render(target)}}

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
        context = await run_in_threadpool(
            build_world_context, world, registry, journal, True, config_dir
        )
        # Contextual chat (Finish Line "Contextual chat and model
        # routing"): the caller may describe WHERE in the UI the person
        # is. Provenance, not truth: an unknown section_id degrades to
        # an honest "unknown" block rather than being trusted or
        # rejected — a stale tab must not break conversation.
        ui = body.get("context") if isinstance(body, dict) else None
        ui_block = None
        if isinstance(ui, dict):
            route = str(ui.get("route") or "") or None
            sid = str(ui.get("section_id") or "") or None
            spec = sections_mod.BY_ID.get(sid) if sid else None
            ui_block = build_ui_context(
                route=route,
                section_id=sid,
                section_label=(spec.label if spec else str(ui.get("label") or "") or None),
                section_status=(
                    sections_mod.section_status(
                        spec, registry.status_map()
                    ) if spec else None
                ),
                section_capabilities=(list(spec.capabilities) if spec else None),
            )
        if ui_block:
            context = context + "\n\n" + ui_block
        messages = build_chat_messages(message, context, history)
        result = await run_in_threadpool(chat_once, impl, messages)
        if not result.ok:
            return result.model_dump(mode="json")
        journal.record(
            "recommendation",
            f"chat exchange with {provider.name} ({len(message)} chars in)",
            source="chat",
        )
        return result.model_dump(mode="json")

    @app.get("/api/chat/providers", dependencies=[Depends(require_auth)])
    def chat_providers() -> dict:
        """List available chat providers and which is active."""
        _, registry = _state()
        providers = []
        active_name = None
        for p in registry._providers.values():
            if p.capability == "reasoning":
                impl = registry.impl(p.name)
                r = impl.observe() if impl else None
                providers.append({
                    "name": p.name,
                    "display_name": getattr(impl, "display_name", p.name),
                    "status": r.status if r else "unknown",
                    "ok": r.ok if r else False,
                })
                if active_name is None and (r and r.ok):
                    active_name = p.name
        # If there's a provider_for, it's the active one
        active = registry.provider_for("reasoning")
        return {
            "ok": True,
            "data": {
                "providers": providers,
                "active": active.name if active else None,
            },
        }

    @app.post("/api/chat/test", dependencies=[Depends(require_auth)])
    async def chat_test() -> dict:
        """Quick chat test — sends a simple message to verify the provider
        works. Authenticated: it spends provider quota and reveals which
        provider is wired, so it is never a public probe."""
        _, registry = _state()
        provider = registry.provider_for("reasoning")
        if provider is None:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no chat provider"]}
        impl = registry.impl(provider.name)
        if impl is None:
            return {"ok": False, "status": "unavailable"}
        result = chat_once(impl, [
            {"role": "system", "content": "Reply with exactly one word: hello"},
            {"role": "user", "content": "hello"},
        ])
        return {"ok": result.ok, "status": result.status,
                "data": result.data, "warnings": result.warnings}

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
    async def prefs_get(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, _, _ = _state_for(request)
        return {"ok": True, "data": prefs.get_prefs(world)}

    @app.put("/api/prefs", dependencies=[Depends(require_step_up)])
    async def prefs_put(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, _, uj = _state_for(request)
        try:
            updates = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        try:
            data = prefs.set_prefs(world, updates)
        except prefs.PrefsValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        uw, _uj = _user_paths(request)
        save_world(world, uw)
        return {"ok": True, "data": data}

    @app.get("/api/prefs/schema", dependencies=[Depends(require_auth)])
    async def prefs_schema() -> dict:
        """Read-only preference vocabulary (spec §2.5): the Settings
        surface can only offer values the server accepts."""
        out: dict[str, dict] = {}
        for key, spec in prefs.PREFS.items():
            if isinstance(spec, prefs.NumberPref):
                out[key] = {
                    "type": "number",
                    "default": spec.default,
                    "floor": spec.floor,
                    "allowed": (list(spec.allowed)
                                if spec.allowed is not None else None),
                    "integer": spec.integer,
                    "unit": spec.unit,
                }
            else:
                out[key] = {
                    "type": "enum",
                    "default": spec.default,
                    "floor": spec.floor,
                    "allowed": list(spec.allowed),
                }
        return {"ok": True, "data": out}

    # -- sections: per-person navigation layout (spec §2) ---------------
    def _sections_payload(world: World, registry: Registry) -> dict:
        status_map = registry.status_map()
        stored = world.layout.get(sections_mod.LAYOUT_KEY)
        return {
            "ok": True,
            "data": {
                "schema": sections_mod.SCHEMA,
                "sections": sections_mod.resolve_sections(stored, status_map),
            },
        }

    @app.get("/api/sections", dependencies=[Depends(require_auth)])
    async def sections_get(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, registry, _ = _state_for(request)
        return _sections_payload(world, registry)

    @app.put("/api/sections", dependencies=[Depends(require_step_up)])
    async def sections_put(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, registry, uj = _state_for(request)
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="body must be an object")
        current = world.layout.get(sections_mod.LAYOUT_KEY) or {}
        new_layout, errors = sections_mod.validate_layout_update(body, current)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        world.layout[sections_mod.LAYOUT_KEY] = new_layout
        uw, _uj = _user_paths(request)
        save_world(world, uw)
        # Whose state is this? The caller's. The event goes to the
        # caller's own journal (shared journal in single mode).
        target = journal if uj == journal.path else Journal(uj)
        target.record(kind=JournalKind.SETTINGS_CHANGE,
                      summary="sections layout updated", source="api")
        return _sections_payload(world, registry)

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

    @app.get("/api/lab/state", dependencies=[Depends(require_auth)])
    async def lab_state() -> dict:
        """Operator packet from the homelab Lab CLI (lab-lowbw/1).

        Presentation-only: the packet is produced by the lab layer;
        this route never derives homelab state itself.
        """
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        r = provider.observe()
        payload = {
            "ok": r.ok,
            "status": r.status,
            "data": r.data or {"rows": [], "reason": r.status},
        }
        if r.warnings:
            payload["warnings"] = r.warnings
        return payload

    @app.get("/api/lab/settings", dependencies=[Depends(require_auth)])
    async def lab_settings() -> dict:
        """Settings Reconciler status via lab CLI."""
        from .providers.lab_settings import LabSettings
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        settings = LabSettings(lab_path=provider.lab_path)
        r = settings.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/settings/inspect/{service}", dependencies=[Depends(require_auth)])
    async def lab_settings_inspect(service: str) -> dict:
        """Inspect desired state for a specific service."""
        from .providers.lab_settings import LabSettings
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        settings = LabSettings(lab_path=provider.lab_path)
        r = settings.inspect(service)
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/settings/diff/{service}", dependencies=[Depends(require_auth)])
    async def lab_settings_diff(service: str) -> dict:
        """Drift between desired and live state for a service."""
        from .providers.lab_settings import LabSettings
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        settings = LabSettings(lab_path=provider.lab_path)
        r = settings.diff(service)
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/health", dependencies=[Depends(require_auth)])
    async def lab_health() -> dict:
        """Health check across all services via lab CLI."""
        from .providers.lab_health import LabHealth
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        health = LabHealth(lab_path=provider.lab_path)
        r = health.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/deploy", dependencies=[Depends(require_auth)])
    async def lab_deploy() -> dict:
        """Deploy status and history via lab CLI."""
        from .providers.lab_deploy import LabDeploy
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        deploy = LabDeploy(lab_path=provider.lab_path)
        r = deploy.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/secrets", dependencies=[Depends(require_auth)])
    async def lab_secrets() -> dict:
        """Secret audit (names only, no values) via lab CLI."""
        from .providers.lab_secrets import LabSecrets
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        secrets = LabSecrets(lab_path=provider.lab_path)
        r = secrets.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/resources", dependencies=[Depends(require_auth)])
    async def lab_resources() -> dict:
        """VM resource usage via lab CLI."""
        from .providers.lab_resources import LabResources
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        resources = LabResources(lab_path=provider.lab_path)
        r = resources.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    # --- Vault endpoints ---

    # --- Vault: one instance per app, survives across requests ---
    # (fresh Vault per request would forget unlock state and secrets)
    from .vault import Vault
    _vault = Vault(data_dir / "vault.enc")

    @app.get("/api/vault/status", dependencies=[Depends(require_auth)])
    async def vault_status() -> dict:
        """Vault status: locked/unlocked, secret count. Never values."""
        return {"ok": True,
                "data": {"locked": not _vault.is_unlocked,
                         "encrypted": True}}

    @app.post("/api/vault/unlock", dependencies=[Depends(require_auth)])
    async def vault_unlock(request: Request) -> dict:
        """Unlock the vault with a master passphrase."""
        body = await request.json()
        passphrase = body.get("passphrase", "")
        if not passphrase:
            raise HTTPException(status_code=400, detail="passphrase required")
        r = _vault.unlock(passphrase)
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.post("/api/vault/lock", dependencies=[Depends(require_auth)])
    async def vault_lock() -> dict:
        """Lock the vault, clearing secrets from memory."""
        _vault.lock()
        return {"ok": True, "data": {"locked": True}}

    @app.get("/api/vault/names", dependencies=[Depends(require_auth)])
    async def vault_names() -> dict:
        """List secret names (never values). Requires unlocked vault."""
        try:
            return {"ok": True, "data": {"names": _vault.list_names()}}
        except RuntimeError:
            raise HTTPException(status_code=409, detail="vault is locked")

    @app.post("/api/vault/set", dependencies=[Depends(require_auth)])
    async def vault_set(request: Request) -> dict:
        """Store a secret. Body: {name, value}."""
        body = await request.json()
        name = body.get("name")
        value = body.get("value")
        if not name or value is None:
            raise HTTPException(status_code=400, detail="name and value required")
        r = _vault.set(name, value)
        if not r.ok:
            return {"ok": r.ok, "status": r.status, "warnings": r.warnings}
        return {"ok": True, "data": {"name": name}}

    @app.get("/api/vault/{name}", dependencies=[Depends(require_auth)])
    async def vault_get(name: str, request: Request) -> dict:
        """Read a single secret value. Loopback-host-only:
        requests from non-loopback Remote-Addr are refused even with a
        valid bearer, keeping secret-value extraction a local-only
        operation (browser/keys never cross the wire).
        Each retrieval audited to the journal with the NAME only."""
        client = request.client.host if request.client else "?"
        # Docker port-forward can show the container gateway (172.16-31.x)
        # for the same host; accept either loopback or private bridge.
        import ipaddress
        try:
            ip = ipaddress.ip_address(client)
        except ValueError:
            ip = None
        loopback = client in ("127.0.0.1", "::1", "localhost", "testclient") or (
            ip is not None and (ip.is_loopback or ip.is_private))
        if not loopback:
            raise HTTPException(
                status_code=403,
                detail=f"vault GET is loopback-only (client={client})")
        try:
            value = _vault.get(name)
        except RuntimeError:
            raise HTTPException(status_code=409, detail="vault is locked")
        if value is None:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        journal.record(
            kind=JournalKind.OBSERVATION,
            summary=f"vault get (name-only): {name}",
            source="api",
        )

        return {"ok": True, "data": {"name": name, "value": value}}

    @app.delete("/api/vault/{name}", dependencies=[Depends(require_auth)])
    async def vault_delete(name: str) -> dict:
        """Delete a secret by name."""
        r = _vault.delete(name)
        if not r.ok:
            return {"ok": r.ok, "status": r.status, "warnings": r.warnings}
        return {"ok": True, "data": {"name": name}}

    # --- Theme pack endpoints ---

    @app.get("/api/themes", dependencies=[Depends(require_auth)])
    async def themes_list() -> dict:
        """List available theme packs."""
        from .theme_pack import ThemePackRegistry
        registry = ThemePackRegistry(data_dir / "theme-packs")
        packs = registry.list_packs()
        return {
            "ok": True,
            "data": [p.model_dump(mode="json") for p in packs],
        }

    @app.get("/api/themes/{name}", dependencies=[Depends(require_auth)])
    async def themes_get(name: str) -> dict:
        """Get a specific theme pack manifest."""
        from .theme_pack import ThemePackRegistry
        registry = ThemePackRegistry(data_dir / "theme-packs")
        pack = registry.get(name)
        return {"ok": True, "data": pack.model_dump(mode="json")}

    # --- Scheduler / Reminders ---

    # One scheduler lives per app (background thread + shared state);
    # per-request Scheduler instances would silently double-fire or
    # miss entirely. Started with the app; stops at FastAPI shutdown.
    from .scheduler import Scheduler, Reminder
    _reminders = Scheduler(data_dir / "reminders.json", journal=journal)

    @app.on_event("startup")
    async def start_scheduler() -> None:
        _reminders.start()

    @app.on_event("shutdown")
    async def stop_scheduler() -> None:
        _reminders.stop()

    # -- identity admin (issue #8 phase 2/3) -----------------------------
    def _is_admin(principal) -> bool:
        """Admin = the bootstrap principal (primary), or a person
        explicitly carrying the admin scope record. Kept deliberately
        small: no roles tree, just this gate."""
        return principal is not None and principal.kind == "person" \
            and (principal.id == "primary" or "admin" in principal.scopes)

    def _require_person(principal) -> None:
        """Person-only surfaces: prefs, journal, notes. Agents are
        refused even with valid tokens — narrow scope model, fail
        closed."""
        if principal is not None and principal.kind == "agent":
            raise HTTPException(status_code=403, detail="person-only surface")

    @app.get("/api/identity/users", dependencies=[Depends(require_auth)])
    async def users_list(request: Request) -> dict:
        principal = getattr(request.state, "principal", None)
        if not _is_admin(principal):
            raise HTTPException(status_code=403, detail="admin only")
        return {"ok": True,
                "data": _identity_store.list_users()}

    @app.post("/api/identity/users", dependencies=[Depends(require_step_up)])
    async def users_create(request: Request) -> dict:
        """Provision a person without touching internals.

        Body: {"user_id", "display_name"?, "token"?"}. Token is
        optional; if omitted the server generates one and returns it
        exactly once. Never stored in the clear.
        """
        principal = getattr(request.state, "principal", None)
        if not _is_admin(principal):
            raise HTTPException(status_code=403, detail="admin only")
        body = await request.json()
        user_id = ((body or {}).get("user_id") or "").strip()
        if not user_id or len(user_id) > 64 or not user_id.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(status_code=422, detail="user_id invalid")
        display = (body or {}).get("display_name") or user_id
        plain = (body or {}).get("token") or secrets.token_urlsafe(24)
        try:
            u = _identity_store.create_user(user_id, display,
                                            initial_plain_token=plain)
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e))
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary=f"user provisioned: {user_id}",
                       source="admin")
        return {"ok": True,
                "data": {"user_id": u["user_id"],
                         "display_name": u.get("display_name"),
                         "token": plain}}

    @app.delete("/api/identity/users/{user_id}",
                dependencies=[Depends(require_step_up)])
    async def users_disable(request: Request, user_id: str) -> dict:
        """Revoke access (disable). Data is preserved, not deleted."""
        principal = getattr(request.state, "principal", None)
        if not _is_admin(principal):
            raise HTTPException(status_code=403, detail="admin only")
        ok = _identity_store.disable_user(user_id)
        if not ok:
            raise HTTPException(status_code=404, detail="no such user")
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary=f"user disabled: {user_id}",
                       source="admin")
        return {"ok": True, "data": {"user_id": user_id, "disabled": True}}

    @app.get("/api/identity/agents", dependencies=[Depends(require_auth)])
    async def agents_list(request: Request) -> dict:
        """Mine (list) — agents owned by the caller; admins see all."""
        principal = getattr(request.state, "principal", None)
        if principal and _is_admin(principal):
            return {"ok": True, "data": _identity_store.list_agents()}
        owner = principal.owner_id if (principal and principal.kind == "agent") else (principal.id if principal else None)
        return {"ok": True, "data": _identity_store.list_agents(owner_id=owner)}

    @app.post("/api/identity/agents", dependencies=[Depends(require_step_up)])
    async def agents_create(request: Request) -> dict:
        """Register an agent principal owned by the caller.

        Body: {"agent_id", "display_name"?, "scopes"?}. Scopes subset
        of read/write/journal/apps. Returns the token exactly once.
        """
        ALLOWED = {"read", "write", "journal", "apps"}
        principal = getattr(request.state, "principal", None)
        if principal is None:
            raise HTTPException(status_code=403, detail="principal required")
        body = await request.json()
        agent_id = ((body or {}).get("agent_id") or "").strip()
        if not agent_id or len(agent_id) > 64 or not agent_id.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(status_code=422, detail="agent_id invalid")
        scopes = [s for s in
                  ((body or {}).get("scopes") or ["read"])
                  if s in ALLOWED] or ["read"]
        plain = secrets.token_urlsafe(24)
        try:
            a = _identity_store.create_agent(agent_id, principal.id,
                                             tuple(scopes),
                                             plain_token=plain)
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e))
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary="agent registered: " + agent_id + " scopes=" + ",".join(scopes),
                       source="admin")
        return {"ok": True,
                "data": {"agent_id": a["user_id"], "owner_id": principal.id,
                         "scopes": scopes, "token": plain}}

    @app.delete("/api/identity/agents/{agent_id}",
                dependencies=[Depends(require_step_up)])
    async def agents_disable(request: Request, agent_id: str) -> dict:
        principal = getattr(request.state, "principal", None)
        ok = _identity_store.disable_agent(agent_id, principal.id)
        if not ok:
            raise HTTPException(status_code=404, detail="no such agent")
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary=f"agent disabled: {agent_id}",
                       source="admin")
        return {"ok": True, "data": {"agent_id": agent_id, "disabled": True}}

    @app.get("/api/apps", dependencies=[Depends(require_auth)])
    async def apps_list(request: Request) -> dict:
        """Services launcher registry (config/data/apps.json).

        Each entry: {id, name, url, icon?, category?}. User-editable,
        optional; absent file = empty list.
        """
        _, _, _uj = _state_for(request)
        path = data_dir / "apps.json"
        if not path.exists():
            return {"ok": True, "data": []}
        try:
            items = json.loads(path.read_text())
        except Exception:
            return {"ok": True, "data": []}
        return {"ok": True, "data": items}

    @app.put("/api/apps", dependencies=[Depends(require_step_up)])
    async def apps_put(request: Request) -> dict:
        """Replace the services registry (step-up gated, like prefs)."""
        _, _, _uj = _state_for(request)
        body = await request.json()
        items = body.get("apps") if isinstance(body, dict) else None
        if not isinstance(items, list):
            raise HTTPException(status_code=422, detail="apps must be a list")
        path = data_dir / "apps.json"
        path.write_text(json.dumps(items, indent=2))
        journal.record(
            kind=JournalKind.SETTINGS_CHANGE,
            summary=f"apps registry updated: {len(items)} services",
            source="api",
        )
        return {"ok": True, "data": items}

    @app.get("/api/reminders", dependencies=[Depends(require_auth)])
    async def reminders_list() -> dict:
        """List all reminders."""
        reminders = _reminders.list_reminders()
        return {"ok": True, "data": [r.model_dump(mode="json") for r in reminders]}

    @app.post("/api/reminders", dependencies=[Depends(require_step_up)])
    async def reminders_add(request: Request) -> dict:
        """Add a reminder. Body: {id, text, cron_hour, cron_minute, cron_day}."""
        body = await request.json()
        rid = body.get("id") or f"r-{int(time.time())}"
        text = body.get("text", "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="text required")
        reminder = Reminder(
            id=rid, text=text,
            cron_hour=body.get("cron_hour"),
            cron_minute=body.get("cron_minute"),
            cron_day=body.get("cron_day"),
        )
        r = _reminders.add(reminder)
        return {"ok": r.ok, "data": r.data, "warnings": r.warnings}

    @app.delete("/api/reminders/{rid}", dependencies=[Depends(require_step_up)])
    async def reminders_delete(rid: str) -> dict:
        """Delete a reminder."""
        r = _reminders.remove(rid)
        return {"ok": r.ok, "data": r.data, "warnings": r.warnings}

    @app.patch("/api/reminders/{rid}", dependencies=[Depends(require_step_up)])
    async def reminders_toggle(rid: str, request: Request) -> dict:
        """Toggle a reminder. Body: {enabled: bool}."""
        from .scheduler import Scheduler
        body = await request.json()
        r = _reminders.toggle(rid, body.get("enabled", True))
        return {"ok": r.ok, "data": r.data, "warnings": r.warnings}

    # --- Source control enrichment ---

    @app.get("/api/source-control/rollups", dependencies=[Depends(require_auth)])
    async def source_control_rollups() -> dict:
        """Commit activity rollups from Gitea."""
        from .providers.gitea_enrichment import GiteaEnrichment
        conn_path = config_dir / "connections.json"
        if conn_path.exists():
            conns = json.loads(conn_path.read_text())
            for c in conns.get("connections", []):
                if c.get("type") == "gitea":
                    impl = GiteaEnrichment(c["base_url"], c.get("token_env", "GITEA_TOKEN"))
                    r = impl.commit_rollups()
                    return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}
        return {"ok": False, "status": "not_configured", "warnings": ["no gitea connection"]}

    @app.get("/api/identity/principal", dependencies=[Depends(require_auth)])
    async def identity_principal(request: Request) -> dict:
        """Read-only: who is calling. Useful for diagnostics and for a
        future onboarding / profiles surface."""
        p = getattr(request.state, "principal", None)
        if p is None:
            raise HTTPException(status_code=409,
                                detail="principal not resolved")
        stored = _identity_store.get_display_name(p.id) if p.kind == "person" else None
        return {"ok": True,
                "data": {"id": p.id, "kind": p.kind,
                         "display_name": stored or p.display_name,
                         "scopes": list(p.scopes),
                         "source": p.source}}

    @app.put("/api/identity/principal", dependencies=[Depends(require_step_up)])
    async def identity_principal_update(request: Request) -> dict:
        """Set the caller's own display name. Persisted in private runtime
        state (data/users.json), never in tracked config. Persons only."""
        p = getattr(request.state, "principal", None)
        if p is None:
            raise HTTPException(status_code=409, detail="principal not resolved")
        _require_person(p)
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="JSON body required")
        name = str((body or {}).get("display_name", "")).strip()
        if not name or len(name) > 80:
            raise HTTPException(status_code=400,
                                detail="display_name must be 1-80 characters")
        _identity_store.set_display_name(p.id, name)
        journal.record(JournalKind.SETTINGS_CHANGE,
                       f"display name updated for {p.id}", source="api")
        return {"ok": True,
                "data": {"id": p.id, "kind": p.kind, "display_name": name,
                         "scopes": list(p.scopes), "source": p.source}}

    @app.get("/api/ingress/rollups", dependencies=[Depends(require_auth)])
    async def ingress_rollups() -> dict:
        """Traefik ingress route rollups (read-only over LAN)."""
        try:
            from .providers.traefik_ingress import TraefikIngress
        except ImportError:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["traefik provider missing"]}
        r = TraefikIngress().observe()
        return {"ok": r.ok, "status": r.status, "data": r.data,
                "warnings": r.warnings}

    # --- Quick actions ---

    @app.post("/api/world/intent", dependencies=[Depends(require_step_up)])
    async def set_intent(request: Request) -> dict:
        """Set an intent. Body: {key, value}."""
        body = await request.json()
        key = body.get("key", "").strip()
        value = body.get("value")
        if not key:
            raise HTTPException(status_code=400, detail="key required")
        world, registry = _state()
        from .model import Intent, Provenance
        intent = Intent(
            key=key, value=value,
            provenance=Provenance(source="dashboard-quick-action"),
        )
        world.set_intent(intent)
        save_world(world, world_path)
        return {"ok": True, "data": {"key": key}}

    @app.post("/api/world/fact", dependencies=[Depends(require_step_up)])
    async def record_fact(request: Request) -> dict:
        """Record a fact. Body: {key, value}."""
        body = await request.json()
        key = body.get("key", "").strip()
        value = body.get("value")
        if not key:
            raise HTTPException(status_code=400, detail="key required")
        world, registry = _state()
        from .model import Fact, Provenance
        fact = Fact(
            key=key, value=value,
            provenance=Provenance(source="dashboard-quick-action"),
        )
        world.record_fact(fact)
        save_world(world, world_path)
        return {"ok": True, "data": {"key": key}}

    @app.post("/api/world/policy", dependencies=[Depends(require_step_up)])
    async def add_policy(request: Request) -> dict:
        """Add a policy. Body: {key, effect}."""
        body = await request.json()
        key = body.get("key", "").strip()
        effect = body.get("effect", "allow")
        if not key:
            raise HTTPException(status_code=400, detail="key required")
        world, registry = _state()
        from .model import Policy, PolicyEffect, Provenance
        try:
            policy = Policy(
                key=key,
                effect=PolicyEffect(effect),
                provenance=Provenance(source="dashboard-quick-action"),
            )
        except ValueError:
            raise HTTPException(status_code=400,
                                detail="effect must be 'allow' or 'deny'")
        try:
            world.set_policy(policy)
        except MutationDenied as exc:
            # a cemented policy is only changeable by an explicit user
            # action through the CLI; the API reports the boundary, it
            # does not crash on it
            raise HTTPException(status_code=409, detail=str(exc))
        save_world(world, world_path)
        return {"ok": True, "data": {"key": key, "effect": effect}}

    # --- Setup page ---

    SETUP_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World — Setup</title>
<meta name="theme-color" content="#0a0810">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/companions/personal-world.svg">
<style>
:root { color-scheme: dark; --bg: #0a0810; --panel: #12101a; --border: #2a2538;
  --text: #f0eaff; --muted: #6b5f82; --accent: #72b1b1; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif;
  margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.setup { background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  padding: 2rem; max-width: 480px; width: 100%; }
h1 { font-size: 1.5rem; margin: 0 0 0.5rem; color: var(--accent); }
p { color: var(--muted); font-size: 0.92rem; margin: 0.5rem 0; }
label { display: block; margin: 1rem 0 0.25rem; font-size: 0.88rem; color: var(--text); }
input { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border);
  border-radius: 6px; padding: 0.55rem; font-size: 1rem; min-height: 44px; }
button { background: var(--accent); color: var(--bg); border: none; border-radius: 6px;
  padding: 0.55rem 1.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;
  min-height: 44px; margin-top: 1.5rem; width: 100%; }
button:hover { opacity: 0.9; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #d4644c; font-size: 0.88rem; margin-top: 0.5rem; }
.success { color: #5fb85f; font-size: 0.88rem; margin-top: 0.5rem; }
</style>
</head>
<body>
<div class="setup">
<h1>Welcome to Personal World</h1>
<p>This is your first run. Set an API token to protect your world. You'll use this token to log in.</p>
<label for="token">API token (min 8 characters)</label>
<input id="token" type="password" placeholder="Choose a token">
<label for="vault-pass">Vault passphrase (optional)</label>
<input id="vault-pass" type="password" placeholder="For your encrypted secret store">
<label for="vault-pass2">Confirm passphrase</label>
<input id="vault-pass2" type="password" placeholder="Confirm">
<button id="go">Set up my world</button>
<div id="err" class="error"></div>
</div>
<script>
document.getElementById('go').addEventListener('click', async () => {
  const token = document.getElementById('token').value;
  const pass = document.getElementById('vault-pass').value;
  const pass2 = document.getElementById('vault-pass2').value;
  if (token.length < 8) { document.getElementById('err').textContent = 'Token must be at least 8 characters.'; return; }
  if (pass && pass !== pass2) { document.getElementById('err').textContent = 'Passphrases do not match.'; return; }
  const r = await fetch('/api/setup', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({token, vault_passphrase: pass})});
  if (!r.ok) { const j = await r.json().catch(() => ({})); document.getElementById('err').textContent = j.detail || 'Setup failed.'; return; }
  localStorage.setItem('pw_token', token);
  window.location.href = '/';
});
</script>
</body>
</html>"""


    @app.get("/setup-wizard", response_class=HTMLResponse)
    async def setup_wizard() -> HTMLResponse:
        """Step-by-step first-run wizard: friendly, low-cognition setup."""
        if frontend_mode == "react":
            return _spa_index()
        if (data_dir / "setup-complete").exists():
            return HTMLResponse(status_code=302, headers={"Location": "/"})
        return HTMLResponse(WIZARD_HTML)

    @app.get("/setup", response_class=HTMLResponse)
    async def setup_page() -> HTMLResponse:
        if frontend_mode == "react":
            return _spa_index()
        if (data_dir / "setup-complete").exists():
            return HTMLResponse(status_code=302, headers={"Location": "/"})
        return HTMLResponse(SETUP_HTML)

    @app.get("/login", response_class=HTMLResponse)
    async def login_page() -> HTMLResponse:
        """Login page — redirects to dashboard if token is in localStorage."""
        if frontend_mode == "react":
            return _spa_index()
        LOGIN_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World — Login</title>
<meta name="theme-color" content="#0a0810">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/companions/personal-world.svg">
<style>
@font-face { font-family: "Instrument Sans"; src: url("/fonts/instrument-sans-var-latin.woff2") format("woff2"); }
@font-face { font-family: "Young Serif"; src: url("/fonts/young-serif-latin.woff2") format("woff2"); }
:root { color-scheme: dark; --bg: #0a0810; --panel: #12101a; --border: #2a2538;
  --text: #f0eaff; --muted: #6b5f82; --accent: #72b1b1; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: "Instrument Sans", system-ui, sans-serif;
  margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login { background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  padding: 2rem; max-width: 400px; width: 100%; text-align: center; }
h1 { font-family: "Young Serif", system-ui, serif; font-size: 1.25rem; margin: 0 0 1rem; color: var(--accent); }
input { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border);
  border-radius: 6px; padding: 0.55rem; font-size: 1rem; min-height: 44px; margin: 0.5rem 0; }
button { background: var(--accent); color: var(--bg); border: none; border-radius: 6px;
  padding: 0.55rem 1.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;
  min-height: 44px; width: 100%; margin-top: 0.5rem; }
.error { color: #d4644c; font-size: 0.88rem; margin-top: 0.5rem; }
</style>
</head>
<body>
<div class="login">
<h1>Personal World</h1>
<input id="token" type="password" placeholder="API token" autofocus>
<button id="go">Enter</button>
<div id="err" class="error"></div>
</div>
<script>
const saved = localStorage.getItem('pw-token') || localStorage.getItem('pw_token');
if (!saved && document.body.getAttribute("data-setup-needed") === "true") window.location.href = "/setup-wizard";

document.getElementById('go').addEventListener('click', () => {
  const t = document.getElementById('token').value;
  if (!t) return;
  localStorage.setItem('pw_token', t);
  window.location.href = '/';
});
document.getElementById('token').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('go').click();
});
</script>
</body>
</html>"""
        setup_needed = not (data_dir / "setup-complete").exists()
        LOGIN_HTML = LOGIN_HTML.replace(
            "<body>", '<body data-setup-needed="' + ("true" if setup_needed else "false") + '">')
        return HTMLResponse(LOGIN_HTML)

    @app.get("/", response_class=HTMLResponse)
    async def dashboard() -> HTMLResponse:
        if frontend_mode == "react":
            return _spa_index()
        # Redirect to setup if first-run not complete
        if not (data_dir / "setup-complete").exists():
            return HTMLResponse(status_code=302, headers={"Location": "/setup"})
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
            .replace("{TODAY}", datetime.datetime.now().strftime("%A, %B %d"))
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

    # SPA fallback: registered LAST (react mode only) so /api/*,
    # /healthz, /companions/*, /icons/* and /fonts/* keep winning by
    # registration order. Legacy mode registers nothing; behaviour is
    # byte-identical to before.
    if frontend_mode == "react":
        # Allowlist built once at app start: every file actually in the
        # dist, keyed by relative POSIX path → resolved absolute Path.
        # No user-controlled value ever constructs a filesystem path, so
        # traversal simply misses the dict (CodeQL path-injection fix).
        _spa_files: dict[str, Path] = {}
        if frontend_dist.is_dir():
            for candidate in frontend_dist.rglob("*"):
                if candidate.is_file():
                    _spa_files[candidate.relative_to(
                        frontend_dist).as_posix()] = candidate.resolve()

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str):
            if full_path == "healthz" or full_path.startswith("api/") or full_path == "api":
                raise HTTPException(status_code=404, detail="not found")
            allowed = _spa_files.get(full_path)
            if allowed is not None and allowed.is_file():
                headers = {}
                if full_path.startswith("assets/"):
                    headers["Cache-Control"] = "public, max-age=31536000, immutable"
                return FileResponse(allowed, headers=headers)
            return _spa_index()

    return app


# Replaced server-side with prefs.prefs_style_block() at render time.
# A marker, not "<style>", so injection can never consume the main
# stylesheet's opening tag (that bug orphaned the whole dashboard CSS
# as visible body text — see the dashboard regression tests).
PREFS_STYLE_MARKER = "<!--PW-PREFS-STYLE-->"

# 503 body for react mode when the dist directory has no index.html.
# Static by design: no environment values, no filesystem paths — a
# private dist path must never be echoed to a browser.
SPA_NOT_BUILT_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Personal World — interface not built</title></head>
<body>
<main id="main-content">
<h1>Personal World's interface is not built</h1>
<p>The web interface files were not found. Build the frontend (<code>npm run build</code> in <code>frontend/</code>) or point <code>PW_FRONTEND_DIST</code> at a built <code>dist/</code> directory, then restart.</p>
<p>The API is still available; nothing else is affected.</p>
</main>
</body>
</html>"""
DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal World — Today</title>
<meta name="theme-color" content="#0a0810">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/companions/personal-world.svg">
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
  --focus-ring: var(--accent-primary);
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
[data-pw-contrast="high"] {
  --bg: #000000; --panel: #0a0a0a; --border: #444444;
  --surface-inset: #1a1a1a; --surface-elevated: #1a1a1a;
  --text: #ffffff; --muted: #cccccc;
  --accent-primary: #8dcfcf; --accent-secondary: #d4969f;
  --focus-ring: #ffffff;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text);
       font-family: var(--font-interface); margin: 0;
       line-height: 1.6; max-width: 100%; overflow-x: hidden;
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
.rail[aria-label="Main"] a { width: var(--pw-target-size, 44px);
        height: var(--pw-target-size, 44px);
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--text-secondary); text-decoration: none;
        border-radius: 8px; }
.rail[aria-label="Main"] a svg { width: 24px; height: 24px; }
.rail[aria-label="Main"] a:hover { background: var(--surface-inset); }
.rail[aria-label="Main"] a[aria-current="page"] {
        background: var(--surface-inset); color: var(--accent-primary); }
.rail .brand-companion { width: 32px; height: 32px; flex: 0 0 32px;
                         border-radius: 6px; overflow: hidden; }
.rail .brand-companion img { width: 100%; height: 100%; display: block; }

h1, h2, h3 { font-family: var(--font-interface); }
h1 { font-family: var(--font-expressive); font-size: var(--size-display);
     margin: 0; font-weight: 400; }
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
main a { display: inline-flex; align-items: center;
         min-height: var(--pw-target-size, 44px); }

/* Reading column (Figma: padding 64px 120px 80px, gap 56px between
   top-level sections; collapses at the 900px narrow design) */
main { padding: 4rem 7.5rem 5rem; display: flex;
       flex-direction: column; gap: 1rem; }
main > section { margin-bottom: 0; padding-bottom: 1rem; }
.greeting { display: flex; flex-wrap: wrap; align-items: flex-start;
            justify-content: space-between; gap: 1rem; }
.greeting h1 { font-family: var(--font-expressive);
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
.brand-title { font-family: var(--font-expressive); font-size: 1.25rem;
               margin: 0; }
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
#auth-box { display: flex; align-items: center; gap: 0.5rem;
            margin: 1rem 7.5rem; flex-wrap: wrap; }
#auth-box .hint { flex-basis: 100%; color: var(--muted); }
#auth-box[hidden] { display: none; }
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
:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.muted { color: var(--muted); }
#msg { color: var(--muted); padding: 0 7.5rem; }
#msg.quiet { position: absolute; width: 1px; height: 1px; padding: 0;
             margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0);
             white-space: nowrap; border: 0; }
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
.cards > li { list-style: none; background: var(--panel);
              border: 1px solid var(--border); border-radius: 8px;
              padding: 0.75rem 1rem; }
.composer { display: flex; gap: 0.5rem; align-items: center;
            flex-wrap: wrap; }
.composer input { flex: 1 1 16rem; }
.composer-templates { display: flex; gap: 0.5rem; flex-wrap: wrap;
                      flex-basis: 100%; }
.composer .chip-btn { min-width: 44px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0;
           margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0);
           white-space: nowrap; border: 0; }
.more-world > summary { min-height: var(--pw-target-size, 44px);
                        display: flex; align-items: center; cursor: pointer;
                        color: var(--text-secondary); }
.more-world[open] > summary { color: var(--text); }
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
            min-height: 12rem; max-height: calc(100dvh - 24rem);
            overflow-y: auto; overscroll-behavior: contain;
            padding: 0.25rem; flex: 1; }
#view-chat.active { min-height: calc(100dvh - 9rem); }
#view-chat > section { display: flex; flex-direction: column;
                       min-height: 0; flex: 1; }
.chat-msg { border-radius: 8px; padding: 0.6rem 0.9rem; max-width: 90%; }
.chat-msg.user { align-self: flex-end; background: var(--surface-elevated);
                 border: 1px solid var(--border); }
.chat-msg.assistant { align-self: flex-start; background: var(--panel);
                       border: 1px solid var(--border); white-space: pre-wrap;
                       overflow-wrap: anywhere; }
.chat-msg.error { align-self: stretch; background: var(--panel);
                  border: 1px dashed var(--accent-secondary); }
.chat-form { display: flex; gap: 0.5rem; margin-top: 0.75rem;
             align-items: flex-end; position: sticky; bottom: 0;
             background: var(--bg); padding-top: 0.5rem; }
.chat-form textarea { flex: 1; min-height: 44px; }
.chat-companion { display: flex; align-items: flex-start; gap: 0.75rem;
                  min-height: 0; flex: 1; }
.chat-companion img { width: 48px; height: 48px; }
.chat-companion:has(#chat-empty) { max-width: 45rem; margin: 1.5rem auto;
                                   align-items: center; flex-direction: column; }
.chat-companion:has(#chat-empty) > span img { width: 64px; height: 64px; }
.chat-empty { display: flex; flex-direction: column; gap: 0.75rem;
              align-items: center; padding: 1rem 0; text-align: center; }
.chat-empty[hidden] { display: none; }
.chat-suggestions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.chat-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
.chat-form button, #note-save { background: var(--accent-primary);
                                border-color: var(--accent-primary);
                                color: var(--surface-canvas); font-weight: 600; }
.prefs-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;
             margin: 0.5rem 0; }
.prefs-row label { min-width: 10rem; }
details.provenance { margin: 0.25rem 0; }
details.provenance summary { cursor: pointer; color: var(--muted);
                             min-height: var(--pw-target-size, 44px);
                             display: flex; align-items: center; }
.journal-filters { display: flex; flex-wrap: wrap; gap: 0.25rem;
                   margin-bottom: 0.5rem; }
/* Narrow design (Figma today-hybrid-narrow-900 + responsive cascade):
   rail collapses to a top banner under 900px */
@media (max-width: 899px) {
  .app-shell { flex-direction: column; }
  .rail { position: static; width: auto; flex-direction: row;
          padding: 0.75rem 1rem; border-right: 0;
          border-bottom: 1px solid var(--border); }
  .wrap { margin-left: 0; }
  header.banner { display: flex; }
  .rail-only { display: none; }
  main { padding: 1.5rem 1rem 2rem; }
  #auth-box { margin: 1rem; }
  #msg { padding: 0 1rem; }
}
@media (max-width: 599px) {
  body { padding: 0; }
  .rail.rail-only { position: fixed; display: flex; z-index: 10;
                    top: auto; right: 0; bottom: 0; width: 100%;
                    min-height: calc(60px + env(safe-area-inset-bottom, 0px));
                    padding: 0.5rem max(0.5rem, env(safe-area-inset-right, 0px))
                             calc(0.5rem + env(safe-area-inset-bottom, 0px))
                             max(0.5rem, env(safe-area-inset-left, 0px));
                    justify-content: center; border: 0;
                    border-top: 1px solid var(--border); background: var(--bg); }
  .rail.rail-only > .rail-group,
  .rail.rail-only .rail-group.nav-gap { display: contents; }
  .rail.rail-only .appliance-logo,
  .rail.rail-only .brand-companion { display: none; }
  header.banner nav[aria-label="Main"] { display: none; }
  .wrap { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }
  .chat-msg { max-width: 100%; }
  main { padding: 1rem 0.75rem 2rem; }
  #auth-box { margin: 0.75rem; }
  #msg { padding: 0 0.75rem; }
  [data-pw-target-size="56"] .rail.rail-only {
    display: grid; grid-template-columns: repeat(3, 56px);
    min-height: calc(128px + env(safe-area-inset-bottom, 0px));
    align-content: center;
  }
  [data-pw-target-size="56"] .wrap {
    padding-bottom: calc(128px + env(safe-area-inset-bottom, 0px));
  }
  .chat-form { bottom: calc(61px + env(safe-area-inset-bottom, 0px)); }
  [data-pw-target-size="56"] .chat-form {
    bottom: calc(129px + env(safe-area-inset-bottom, 0px));
  }
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
<a href="#vault" data-route="vault" aria-label="Vault"><svg aria-hidden="true" width="24" height="24"><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>
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
<p id="brand" class="brand-title">Personal World</p>
</div>
<nav aria-label="Main">
<a href="#today" data-route="today">Today</a>
<a href="#chat" data-route="chat">Chat</a>
<a href="#world" data-route="world">World</a>
<a href="#journal" data-route="journal">Journal</a>
<a href="#vault" data-route="vault">Vault</a>
<a href="#settings" data-route="settings">Settings</a>
</nav>
</header>
<form id="auth-box">
<input type="text" name="username" autocomplete="username" value="personal-world" hidden>
<label for="token" class="muted" style="display:none">API token</label>
<input id="token" type="password" placeholder="Access code" aria-label="Access code" autocomplete="current-password">
<button id="go" type="submit" aria-label="Show my world">Show my world</button>
<p class="hint">Your access code stays in this browser only.</p>
</form>
<p id="msg" role="status" aria-live="polite"></p>
<main id="main-content">
<section id="view-today" class="view active" aria-labelledby="today-h1">
<div class="greeting">
<div>
<h1 id="today-h1">Today</h1>
<div class="meta-row"><span id="today-date">{TODAY}</span><span class="meta-dot" aria-hidden="true"></span><span id="today-state-line">Personal World Appliance active</span></div>
</div>
<span class="motif-badge"><span class="motif-planet" aria-hidden="true"></span>Home world</span>
</div>
<hr class="hr">
<section aria-labelledby="today-health-h2">
<h2 id="today-health-h2">World health</h2>
<div id="today-health" class="muted">Checking your world…</div>
</section>
<hr class="hr">
<section aria-labelledby="today-attention-h2">
<h2 id="today-attention-h2">Needs attention</h2>
<ul id="today-attention" class="cards"><li class="muted">Checking what needs you…</li></ul>
</section>
<hr class="hr">
<section aria-labelledby="today-changes-h2">
<h2 id="today-changes-h2">Recent changes</h2>
<div id="today-changes" class="muted">Checking recent changes…</div>
</section>
<hr class="hr">
<section aria-labelledby="today-rollups-h2">
<h2 id="today-rollups-h2">Discovery</h2>
<div id="today-rollups" class="muted">Looking for recent activity…</div>
</section>
<hr class="hr">
<section aria-labelledby="today-journal-h2">
<h2 id="today-journal-h2">Journal</h2>
<div class="composer">
  <label for="note-text" class="sr-only">Quick journal entry</label>
  <input id="note-text" type="text" maxlength="2000" placeholder="A thought, a win, something to remember…" autocomplete="off">
  <button id="note-save" type="button">Save entry</button>
  <span id="note-status" class="muted" role="status"></span>
  <div class="composer-templates" role="group" aria-label="Quick templates">
    <button type="button" class="chip-btn" data-prefill="win: ">win:</button>
    <button type="button" class="chip-btn" data-prefill="blocker: ">blocker:</button>
    <button type="button" class="chip-btn" data-prefill="remember: ">remember:</button>
  </div>
</div>
<h3>Recent entries</h3>
<ul id="today-journal"><li class="muted">Opening your journal…</li></ul>
<p><a href="#journal">View all</a></p>
</section>
<hr class="hr">
<details class="more-world">
<summary>More from your world</summary>
<section aria-labelledby="today-services-h2">
<h2 id="today-services-h2">Services</h2>
<ul id="today-services" class="cards"><li class="muted">Opening your services…</li></ul>
<div class="composer svc-editor">
  <label for="svc-name" class="sr-only">Service name</label>
  <input id="svc-name" type="text" placeholder="Service name" autocomplete="off">
  <label for="svc-url" class="sr-only">Service URL</label>
  <input id="svc-url" type="url" placeholder="https://…" autocomplete="off">
  <button id="svc-add" type="button">Add service</button>
  <span id="svc-status" class="muted" role="status"></span>
</div>
</section>
<section aria-labelledby="today-quota-h2">
<h2 id="today-quota-h2">Subscription usage</h2>
<div id="today-quota" class="muted">Checking usage…</div>
</section>
<section aria-labelledby="today-caps-h2">
<h2 id="today-caps-h2">Capabilities</h2>
<div class="scroll" role="region" aria-label="Capabilities table" tabindex="0">
<table id="today-caps"><thead><tr><th>Area</th><th>Status</th></tr></thead>
<tbody><tr><td colspan="2" class="muted">Checking capabilities…</td></tr></tbody></table>
</div>
</section>
</details>
</section>
<section id="view-chat" class="view" aria-labelledby="chat-h1">
<h1 id="chat-h1">Chat</h1>
<section aria-labelledby="chat-surface-h2">
<h2 id="chat-surface-h2">Talk with your world</h2>
<details class="provenance" id="chat-provider-info">
<summary>Conversation details</summary>
<p id="chat-provider-text" class="muted">Checking the conversation connection…</p>
</details>
<div class="chat-companion">
<span data-pw-companion-slot="chat" aria-hidden="true"><img src="/companions/personal-world.svg"
 alt="" width="48" height="48"></span>
<div id="chat-log" role="region" aria-label="Conversation">
<div class="chat-empty" id="chat-empty">
<p class="muted">Ask about today, your journal, or what needs you. Chat can look, but it cannot change your world.</p>
<div class="chat-suggestions" role="group" aria-label="Conversation starters">
<button type="button" data-chat-prompt="How is my world today?">How is my world?</button>
<button type="button" data-chat-prompt="What changed today?">What changed today?</button>
<button type="button" data-chat-prompt="Does anything need me?">Anything need me?</button>
</div>
</div>
</div>
</div>
<form class="chat-form" id="chat-form">
<label for="chat-input" class="sr-only">Message</label>
<textarea id="chat-input" rows="2" maxlength="4000" placeholder="Ask your world…" aria-describedby="chat-status"></textarea>
<button id="chat-send" type="submit">Send</button>
</form>
<p class="muted" id="chat-status" role="status" aria-live="polite"></p>
</section>
</section>
<section id="view-world" class="view" aria-labelledby="world-h1">
<h1 id="world-h1">World</h1>
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
<section aria-labelledby="world-lab-h2">
<h2 id="world-lab-h2">Lab status</h2>
<p class="muted">Operator packet from the homelab Lab CLI. The lab layer owns this truth; this view only presents it.</p>
<div id="world-lab" class="muted">Loading…</div>
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
<h1 id="journal-h1">Journal</h1>
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
<h1 id="settings-h1">Settings</h1>
<section aria-labelledby="settings-appearance-h2">
<h2 id="settings-appearance-h2">Reading &amp; interaction</h2>
<p class="muted">Preferences apply immediately and are saved to your world. The accessibility floor (44px targets, reduced motion, readable contrast) can never be lowered.</p>
<div id="settings-prefs" class="muted">Loading…</div>
</section>
<section aria-labelledby="settings-themes-h2">
<h2 id="settings-themes-h2">Companion &amp; theme</h2>
<p class="muted">Choose your companion character. The globe is the default; other packs are optional.</p>
<div id="settings-themes" class="muted">Loading…</div>
</section>
<section aria-labelledby="settings-chat-h2">
<h2 id="settings-chat-h2">Chat provider</h2>
<p class="muted">Choose which model powers your conversations. MiMo 2.5 via OpenCode is the default.</p>
<div id="settings-chat-providers" class="muted">Loading…</div>
</section>
<section aria-labelledby="settings-reminders-h2">
<h2 id="settings-reminders-h2">Reminders</h2>
<p class="muted">Scheduled reminders that fire into your journal.</p>
<div id="settings-reminders" class="muted">Loading…</div>
<div style="margin-top:0.5rem">
<input id="reminder-text" placeholder="Reminder text" style="width:60%">
<button id="reminder-add" type="button">Add</button>
</div>
</section>
<section aria-labelledby="settings-export-h2">
<h2 id="settings-export-h2">Capability &amp; pack settings</h2>
<p class="muted">Settings export is whitelist-based; private and secret material never appears here.</p>
<div id="settings-body" class="muted">Loading…</div>
</section>
</section>
<section id="view-vault" class="view" aria-labelledby="vault-h1">
<h1 id="vault-h1">Vault</h1>
<p class="muted">Encrypted secret store. Secrets are encrypted at rest and decrypted only in memory when unlocked.</p>
<div id="vault-status" class="muted">Loading…</div>
<form id="vault-unlock" style="margin:1rem 0;display:none">
<input type="text" name="username" autocomplete="username" value="personal-world" hidden>
<label for="vault-pass" class="muted">Master passphrase</label>
<div style="display:flex;gap:0.5rem;align-items:flex-start">
<input id="vault-pass" type="password" placeholder="Passphrase" autocomplete="current-password" style="width:60%">
<button id="vault-unlock-btn" type="button">Unlock</button>
</div>
</form>
<form id="vault-content" style="display:none">
<input type="text" name="username" autocomplete="username" value="personal-world" hidden>
<div id="vault-list" class="muted">Loading…</div>
<div style="margin-top:1rem;display:flex;gap:0.5rem;align-items:flex-start">
<input id="vault-name" placeholder="Secret name" autocomplete="off" style="width:30%">
<input id="vault-value" type="password" placeholder="Secret value" autocomplete="new-password" style="width:40%">
<button id="vault-set-btn" type="button">Store</button>
</div>
<p class="muted" style="margin-top:0.5rem">Values are never displayed after storage. Only names are shown.</p>
</form>
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
function setMsg(t, quiet, announce = true) {
  $('msg').setAttribute('aria-live', announce ? 'polite' : 'off');
  $('msg').textContent = t;
  $('msg').classList.toggle('quiet', Boolean(quiet));
}
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
  const headers = Object.assign({'Authorization': 'Bearer ' + token},
    (opts && opts.headers) || {});
  if (opts && opts.body) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, Object.assign({}, opts, {headers}));
  if (r.status === 401) return {error: 'unauthorized'};
  if (r.status === 503) return {error: 'no_auth'};
  if (r.status === 400) { const j = await r.json().catch(() => ({}));
    return {error: j.detail || 'bad_request'}; }
  if (!r.ok) return {error: 'http_' + r.status};
  return {data: await r.json()};
}
function unavailable(reason) {
  return {ok: false, status: 'unavailable', warnings: [reason]};
}
function ageText(value) {
  const dt = new Date(value);
  if (!value || Number.isNaN(dt.getTime())) return 'unknown';
  const mins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
  if (mins < 60) return mins + ' min';
  if (mins < 1440) return Math.floor(mins / 60) + ' h';
  return Math.floor(mins / 1440) + ' d';
}
function eventTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
function eventSummary(event) {
  const summary = String(event.summary || 'Journal entry');
  if (summary.toLowerCase().startsWith('chat exchange with ')) {
    return 'A conversation with Personal World';
  }
  return summary;
}
function humanizeAttention(value) {
  const text = String(value || '');
  const available = text.match(/^available: .+ \\(([^)]+)\\) — not enabled for writes$/);
  const human = available
    ? available[1].replaceAll('_', ' ') + ' is ready for looking, not changing things.'
    : text.replaceAll('_', ' ');
  return human.charAt(0).toUpperCase() + human.slice(1);
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
  {key: 'contrast', label: 'Contrast', type: 'select',
   options: [['comfortable', 'Comfortable'], ['high', 'High']]},
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
function applyPreferences(saved) {
  const root = document.documentElement;
  for (const spec of PREF_SPEC) {
    const value = saved[spec.key];
    if (value == null) continue;
    root.setAttribute('data-pw-' + spec.key.replace('_', '-'),
      String(value).replace('_', '-'));
  }
  if (saved.text_scale != null) root.style.setProperty('--pw-text-scale', saved.text_scale);
  if (saved.target_size != null) root.style.setProperty('--pw-target-size', saved.target_size + 'px');
  if (saved.companion) applyCompanion(saved.companion);
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
      state.prefs = (res.data && res.data.data) || Object.assign({}, state.prefs, upd);
      applyPreferences(state.prefs);
      setMsg('Saved ' + spec.label.toLowerCase() + ' — ' + nowHHMM());
    });
    row.appendChild(label); row.appendChild(sel); host.appendChild(row);
  }
  const note = el('p', 'Motion stays reduced. Both contrast choices keep the accessibility floor.', 'muted');
  host.appendChild(note);
}
/* ---- Today ---- */
function renderToday() {
  if (state.status) {
    const healthDiv = $('today-health'); clear(healthDiv);
    if (!state.status.ok) {
      healthDiv.appendChild(el('p', 'Current health could not be checked. Your journal and saved world are still available.'));
      $('today-state-line').textContent = 'Some current details are unavailable';
    } else {
    const caps = (state.status.data && state.status.data.capabilities) || {};
    const capKeys = Object.keys(caps);
    const healthy = capKeys.filter(k => caps[k].status === 'healthy').length;
    const total = capKeys.length;
    const vacant = capKeys.filter(k => caps[k].status === 'not_configured').length;
    const uncertain = capKeys.filter(k => caps[k].status === 'unknown').length;
    const actionable = capKeys.filter(k => ['warning', 'unhealthy', 'needs_attention',
      'unavailable', 'stale'].includes(caps[k].status)).length;
    if (total === 0) {
      healthDiv.appendChild(el('p', 'Your world is ready. Nothing is connected yet.'));
      $('today-state-line').textContent = 'Ready when you are';
    } else if (actionable === 0 && uncertain > 0) {
      healthDiv.appendChild(el('p', 'Nothing urgent, but ' + uncertain +
        (uncertain === 1 ? ' capability has' : ' capabilities have') +
        ' not been checked yet. ' + healthy + ' are healthy.'));
      $('today-state-line').textContent = 'Some details are still unknown';
    } else if (actionable === 0) {
      healthDiv.appendChild(el('p', 'Nothing urgent. ' + healthy + ' capabilities are healthy' +
        (vacant ? ', and ' + vacant + ' are waiting until you need them.' : '.')));
      $('today-state-line').textContent = 'Your world is quietly humming';
    } else {
      healthDiv.appendChild(el('p', actionable + ' ' + (actionable === 1 ? 'thing needs' : 'things need') +
        ' a look. ' + healthy + ' capabilities are healthy.'));
      $('today-state-line').textContent = 'A few things may need a look';
    }
    const obs = capKeys.map(k => caps[k].last_observed).filter(Boolean).sort().pop();
    if (obs) healthDiv.appendChild(el('p', 'Last observed ' + ageText(obs) + ' ago.'));
    const tbody = $('today-caps').querySelector('tbody'); clear(tbody);
    if (capKeys.length === 0) {
      const tr = el('tr'); const td = el('td', 'No capabilities defined.');
      td.setAttribute('colspan', '2'); tr.appendChild(td); tbody.appendChild(tr);
    } else {
      for (const k of capKeys) {
        const tr = el('tr'); tr.appendChild(el('td', k.replaceAll('_', ' ')));
        const td = el('td'); td.appendChild(chip(caps[k].status));
        if (caps[k].last_observed) {
          td.appendChild(document.createTextNode(' — observed ' + ageText(caps[k].last_observed) + ' ago'));
        }
        if (caps[k].warnings && caps[k].warnings.length) {
          td.appendChild(document.createTextNode(' — ' + caps[k].warnings[0]));
        }
        tr.appendChild(td); tbody.appendChild(tr);
      }
    }
    }
  }
  if (state.daily) {
    const att = $('today-attention'); clear(att);
    const items = (state.daily.data && state.daily.data.attention) || [];
    if (!state.daily.ok) att.appendChild(el('li', 'Attention could not be checked. The rest of your world remains available.'));
    else if (items.length === 0) att.appendChild(el('li', 'Nothing needs your attention.'));
    else for (const item of items.slice(0, 5)) att.appendChild(el('li', humanizeAttention(item)));
    const ch = $('today-changes'); clear(ch);
    const changed = (state.daily.data && state.daily.data.actions) || [];
    if (!state.daily.ok) ch.appendChild(el('p', 'Recent changes could not be checked.'));
    else if (changed.length === 0) ch.appendChild(el('p', 'No recorded changes today.'));
    else {
      const ul = el('ul');
      for (const item of changed.slice(0, 5)) ul.appendChild(el('li', item));
      ch.appendChild(ul);
    }
  }
  if (state.journal) {
    const jl = $('today-journal'); clear(jl);
    const events = state.journal.data || [];
    const source = events.filter(event =>
      !String(event.summary || '').toLowerCase().startsWith('capability '));
    const recent = []; const seen = new Set();
    for (const event of source.slice().reverse()) {
      const summary = eventSummary(event);
      if (seen.has(summary)) continue;
      seen.add(summary); recent.push(event);
      if (recent.length === 5) break;
    }
    const last5 = recent;
    if (!state.journal.ok) jl.appendChild(el('li', 'Your journal could not be opened just now. Your note box is unchanged.'));
    else if (last5.length === 0) jl.appendChild(el('li', 'No journal entries yet. This is a gentle place to begin.'));
    else for (const event of last5) {
      const li = el('li');
      const t = el('time', eventTime(event.ts)); t.dateTime = event.ts || '';
      li.appendChild(t); li.appendChild(document.createTextNode(' — '));
      li.appendChild(document.createTextNode(eventSummary(event))); jl.appendChild(li);
    }
  }
  renderServices(); renderQuota(); renderRollups();
}

function renderServices() {
  if (!state.apps) return;
  const host = $('today-services'); clear(host);
  if (!state.apps.ok) {
    host.appendChild(el('li', 'Saved services could not be opened. You can try again later.'));
    return;
  }
  const apps = Array.isArray(state.apps.data) ? state.apps.data : [];
  if (apps.length === 0) {
    host.appendChild(el('li', 'No services saved here yet. Add one when it would be useful.'));
    return;
  }
  for (const app of apps) {
    const li = el('li');
    const link = el('a', app.name || app.id || 'Service');
    link.href = app.url || '#'; link.rel = 'noopener';
    li.appendChild(link);
    if (app.category) li.appendChild(document.createTextNode(' — ' + app.category));
    host.appendChild(li);
  }
}

function renderQuota() {
  if (!state.lab) return;
  const host = $('today-quota'); clear(host);
  if (!state.lab.ok) {
    host.appendChild(el('p', 'Usage details are unavailable right now. Everything else still works.'));
    return;
  }
  const observations = [...((state.lab.data && state.lab.data.rows) || [])
    .flatMap(row => row.observations || [])];
  const quota = observations.filter(observation => {
    const detail = String(observation.detail || '');
    return detail.includes('credit balance') || detail.includes('/used ') ||
      (detail.includes('window') && detail.includes('%') && detail.includes('resets'));
  });
  if (quota.length === 0) {
    host.appendChild(el('p', 'No current subscription limits need your attention.'));
    return;
  }
  const ul = el('ul'); ul.className = 'cards';
  for (const observation of quota) ul.appendChild(el('li', observation.detail || 'Usage observation'));
  host.appendChild(ul);
}

function renderRollups() {
  if (!state.srcRollups) return;
  const host = $('today-rollups'); clear(host);
  const rows = state.srcRollups.ok && state.srcRollups.data
    ? state.srcRollups.data.rollups || [] : [];
  if (!state.srcRollups.ok) {
    host.appendChild(el('p', 'Discovery is quiet because current source activity could not be checked.'));
    return;
  }
  if (rows.length === 0) {
    host.appendChild(el('p', 'Nothing new surfaced here today.'));
    return;
  }
  const ul = el('ul'); ul.className = 'cards';
  for (const row of rows.slice(0, 5)) {
    const li = el('li');
    li.appendChild(el('strong', row.repo || 'Source work'));
    li.appendChild(document.createTextNode(' — ' + row.commit_count + ' recent changes'));
    if (row.last_commit) {
      const details = el('details', null, {class: 'provenance'});
      details.appendChild(el('summary', 'What changed'));
      details.appendChild(el('p', row.last_commit)); li.appendChild(details);
    }
    ul.appendChild(li);
  }
  host.appendChild(ul);
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
  const lab = $('world-lab'); clear(lab);
  const lp = state.lab;
  if (!lp || lp.ok === false) {
    const why = (lp && lp.warnings && lp.warnings[0]) || 'not configured';
    lab.appendChild(el('p', 'Lab: ' + statusWord(lp && lp.status) + ' — ' + why));
  } else {
    const rows = (lp.data && lp.data.rows) || [];
    lab.appendChild(el('p', rows.length + ' operator rows — evidence freshness enforced upstream.'));
    const tbl = el('table'); const thead = el('thead'); const trh = el('tr');
    for (const h of ['Row', 'Items', 'State', 'Freshness']) {
      trh.appendChild(el('th', h));
    }
    thead.appendChild(trh); tbl.appendChild(thead);
    const tbody = el('tbody');
    for (const r of rows) {
      const tr = el('tr');
      tr.appendChild(el('td', r.row));
      tr.appendChild(el('td', String(r.count)));
      if (r.unrecognized) {
        tr.appendChild(el('td', 'unrecognized row (schema grew upstream)'));
      } else {
        const td = el('td'); td.appendChild(chip(r.stale ? 'stale' : 'healthy'));
        tr.appendChild(td);
      }
      tr.appendChild(el('td', r.stale ? 'stale' : 'current'));
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    const wrap = el('div'); wrap.className = 'scroll'; wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Lab operator rows table'); wrap.setAttribute('tabindex', '0');
    wrap.appendChild(tbl); lab.appendChild(wrap);
    // Evidence details, per row, inside progressive disclosure.
    for (const r of rows) {
      if (!r.observations || r.observations.length === 0) continue;
      const d = el('details', null, {class: 'provenance'});
      d.appendChild(el('summary', r.row + ' — ' + r.observations.length + ' observation(s)'));
      for (const o of r.observations) {
        const p = el('p', (o.detail || '').slice(0, 140) +
          (o.observed_at ? ' — observed ' + o.observed_at.slice(0, 16) : ''));
        d.appendChild(p);
        if (o.action) {
          d.appendChild(el('p', 'action: ' + o.action.slice(0, 140)));
        }
      }
      lab.appendChild(d);
    }
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
  renderGiteaRollups();
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
    const t = el('time', eventTime(e.ts)); t.dateTime = e.ts || '';
    li.appendChild(t); li.appendChild(document.createTextNode(' — '));
    li.appendChild(el('strong', e.kind));
    li.appendChild(document.createTextNode(': ' + eventSummary(e)));
    if (e.provenance || eventSummary(e) !== e.summary) {
      const details = el('details', null, {class: 'provenance'});
      details.appendChild(el('summary', 'Source'));
      if (e.provenance && e.provenance.source) {
        details.appendChild(el('p', 'Recorded by ' + e.provenance.source + '.'));
      }
      if (eventSummary(e) !== e.summary) details.appendChild(el('p', e.summary));
      li.appendChild(details);
    }
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
function chatNearBottom() {
  const log = $('chat-log');
  return log.scrollHeight - log.scrollTop - log.clientHeight < 80;
}
function appendChatMessage(role, text, source) {
  const log = $('chat-log');
  const message = el('div', null, {class: 'chat-msg ' + role});
  message.appendChild(el('div', text));
  if (role === 'assistant' && source) {
    const details = el('details', null, {class: 'provenance'});
    details.appendChild(el('summary', 'Sources'));
    details.appendChild(el('p', 'Read-only Personal World snapshot'));
    if (source.model) details.appendChild(el('p', 'Conversation model: ' + source.model));
    message.appendChild(details);
  }
  log.appendChild(message);
  return message;
}
function persistChat() {
  if (!state.chatStorageKey) return;
  try { sessionStorage.setItem(state.chatStorageKey, JSON.stringify(state.chatHistory || [])); }
  catch (error) { /* Conversation remains available in this page. */ }
}
function chatTokenScope(token) {
  let first = 2166136261; let second = 2246822507;
  for (let index = 0; index < token.length; index += 1) {
    const code = token.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return (first >>> 0).toString(16).padStart(8, '0') +
    (second >>> 0).toString(16).padStart(8, '0');
}
async function restoreChat(token) {
  const nextKey = 'pw_chat_history_' + chatTokenScope(token);
  if (state.chatStorageKey && state.chatStorageKey !== nextKey) {
    state.chatHistory = [];
    for (const message of document.querySelectorAll('#chat-log .chat-msg')) message.remove();
    const empty = $('chat-empty'); if (empty) empty.hidden = false;
  }
  state.chatStorageKey = nextKey;
  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(state.chatStorageKey) || '[]'); }
  catch (error) { history = []; }
  if (!Array.isArray(history) || history.length === 0) return;
  state.chatHistory = history.filter(turn => turn && ['user', 'assistant'].includes(turn.role)
    && typeof turn.content === 'string').slice(-6);
  if (state.chatHistory.length === 0) return;
  const empty = $('chat-empty'); if (empty) empty.hidden = true;
  for (const turn of state.chatHistory) appendChatMessage(turn.role, turn.content, turn.source);
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}
function setChatBusy(busy) {
  state.chatBusy = busy;
  $('chat-send').disabled = busy;
  $('chat-input').disabled = busy;
}
function appendChatError(text, retryText) {
  const card = el('div', null, {class: 'chat-msg error'});
  card.appendChild(el('strong', 'Conversation paused'));
  card.appendChild(el('p', text));
  const actions = el('div', null, {class: 'chat-actions'});
  const retry = el('button', 'Retry'); retry.type = 'button';
  retry.addEventListener('click', () => { card.remove(); sendChat(retryText, false); });
  const keep = el('button', 'Keep writing'); keep.type = 'button';
  keep.addEventListener('click', () => $('chat-input').focus());
  actions.appendChild(retry); actions.appendChild(keep); card.appendChild(actions);
  $('chat-log').appendChild(card);
}
async function sendChat(textOverride, showUser = true) {
  const input = $('chat-input');
  const text = String(textOverride || input.value || '').trim();
  if (!text || state.chatBusy) return;
  if (!state.token) { setChatStatus('Open your world before starting a conversation.', true); return; }
  const log = $('chat-log');
  const empty = $('chat-empty');
  if (empty) empty.hidden = true;
  if (showUser) appendChatMessage('user', text);
  input.value = '';
  setChatBusy(true);
  setChatStatus('Thinking… You can keep reading while your world checks its sources.', false, false);
  const thinking = el('div', 'Checking your world…', {class: 'chat-msg assistant'});
  log.appendChild(thinking); log.scrollTop = log.scrollHeight;
  let res;
  try {
    res = await api(state.token, '/api/chat', {
      method: 'POST',
      body: JSON.stringify({message: text, history: state.chatHistory || []}),
    });
  } catch (error) { res = {error: 'unreachable'}; }
  const follow = chatNearBottom();
  setChatBusy(false); thinking.remove();
  if (res.error) {
    appendChatError('The conversation connection did not answer. Your world and journal still work.', text);
    setChatStatus('Conversation unavailable. Nothing else was interrupted.', true);
    input.focus(); return;
  }
  if (res.data && res.data.ok === false) {
    appendChatError('Conversation is ' + statusWord(res.data.status) +
      ' right now. Your world and journal still work.', text);
    setChatStatus('Conversation paused. Nothing else was interrupted.', true);
    input.focus(); return;
  }
  const reply = (res.data && res.data.data && res.data.data.reply) || '';
  const source = res.data.data || {};
  appendChatMessage('assistant', reply || 'I did not receive a readable reply.', source);
  state.chatHistory = (state.chatHistory || []).concat(
    [{role: 'user', content: text},
     {role: 'assistant', content: reply, source: {model: source.model || ''}}]).slice(-6);
  persistChat();
  setChatStatus('Reply received ' + nowHHMM() + '.');
  if (follow) log.scrollTop = log.scrollHeight;
  input.focus();
}
function setChatStatus(t, isErr, announce = true) {
  const s = $('chat-status');
  s.setAttribute('aria-live', announce ? 'polite' : 'off');
  s.textContent = t;
  s.className = isErr ? '' : 'muted';
}
function renderAll() {
  renderToday();
  if (state.world && state.actors && state.sourceControl && state.updates) renderWorld();
  if (state.journal) renderJournal();
  if (state.settings) renderSettings();
  buildSettingsPrefs(state.prefs || {});
  syncRoute();
}
async function loadPart(key, path, render) {
  try {
    const result = await api(state.token, path);
    state[key] = result.error ? unavailable(result.error) : result.data;
  } catch (error) {
    state[key] = unavailable('could not reach this part of your world');
  }
  if (render) render();
}
async function load() {
  const dEl = document.getElementById('today-date');
  if (dEl) dEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let token = $('token').value;
  if (!token) token = localStorage.getItem('pw-token') || localStorage.getItem('pw_token') || '';
  const authBox = document.getElementById('auth-box');
  if (!token) {
    if (authBox) authBox.hidden = false;
    setMsg('Waiting for your access code — paste it below to show your world.');
    return;
  }
  if (state.authBusy) return;
  state.authBusy = true;
  $('go').disabled = true; $('token').disabled = true;
  const releaseAuth = () => {
    state.authBusy = false;
    $('go').disabled = false; $('token').disabled = false;
  };
  setMsg('Opening your world…', false, false);
  let prefsRes;
  try {
    prefsRes = await api(token, '/api/prefs');
  } catch (e) {
    if (authBox) authBox.hidden = false;
    setMsg('Personal World could not be reached. Your access code is still safe here.');
    releaseAuth();
    return;
  }
  if (prefsRes.error === 'unauthorized') {
    if (authBox) authBox.hidden = false;
    setMsg('That access code did not unlock your world. Check it and try again.');
    releaseAuth();
    return;
  }
  if (prefsRes.error === 'no_auth') {
    if (authBox) authBox.hidden = false;
    setMsg('Personal World is not ready for access yet.');
    releaseAuth();
    return;
  }
  if (prefsRes.error) {
    if (authBox) authBox.hidden = false;
    setMsg('Personal World could not be reached. Everything you entered is still here.');
    releaseAuth();
    return;
  }
  state.token = token;
  localStorage.setItem('pw_token', token);
  state.prefs = (prefsRes.data && prefsRes.data.data) || {};
  applyPreferences(state.prefs);
  await restoreChat(token);
  if (authBox) authBox.hidden = true;
  renderAll();
  setMsg('Your world is open. Checking current details…', false, false);
  await Promise.allSettled([
    loadPart('journal', '/api/journal?n=100', () => { renderToday(); renderJournal(); }),
    loadPart('apps', '/api/apps', renderToday),
    loadPart('status', '/api/status', renderToday),
    loadPart('daily', '/api/daily', renderToday),
    loadPart('srcRollups', '/api/source-control/rollups', renderToday),
    loadPart('lab', '/api/lab/state', () => {
      renderToday();
      if (state.world && state.actors && state.sourceControl && state.updates) renderWorld();
    }),
  ]);
  setMsg('Your world is ready.', true);
  releaseAuth();
}
const state = {routeLoads: {}};
async function loadRouteData(route) {
  if (!state.token || route === 'today' || state.routeLoads[route]) return;
  state.routeLoads[route] = true;
  try {
    if (route === 'world') {
      await Promise.allSettled([
        loadPart('world', '/api/exports/world'),
        loadPart('actors', '/api/actors'),
        loadPart('sourceControl', '/api/source-control/status'),
        loadPart('updates', '/api/updates'),
      ]);
      renderWorld();
    } else if (route === 'journal' && !state.journal) {
      await loadPart('journal', '/api/journal?n=100', renderJournal);
    } else if (route === 'settings') {
      if (!state.settings) await loadPart('settings', '/api/exports/settings', renderSettings);
      await Promise.allSettled([renderThemes(), renderReminders(), renderChatProviders()]);
    } else if (route === 'chat') {
      await renderChatProvider();
    } else if (route === 'vault') {
      await renderVault();
    }
  } catch (error) {
    setMsg('This part of your world could not be opened. You can try it again.', false);
  } finally {
    state.routeLoads[route] = false;
  }
}
function syncRoute() {
  const h = (location.hash || '#today').replace('#', '');
  const routes = ['today', 'chat', 'world', 'journal', 'vault', 'settings'];
  const r = routes.includes(h) ? h : 'today';
  document.title = 'Personal World — ' + r[0].toUpperCase() + r.slice(1);
  for (const x of routes) {
    const v = $('view-' + x); if (v) v.classList.toggle('active', x === r);
  }
  for (const a of document.querySelectorAll('nav[aria-label="Main"] a')) {
    if (a.getAttribute('data-route') === r) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
  loadRouteData(r);
}
window.addEventListener('hashchange', syncRoute);
$('auth-box').addEventListener('submit', e => { e.preventDefault(); load(); });
$('chat-form').addEventListener('submit', e => { e.preventDefault(); sendChat(); });
$('chat-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('chat-form').requestSubmit();
  }
});
for (const button of document.querySelectorAll('[data-chat-prompt]')) {
  button.addEventListener('click', () => {
    $('chat-input').value = button.getAttribute('data-chat-prompt') || '';
    $('chat-input').focus();
  });
}
async function saveNote() {
  if (state.noteBusy) return;
  const input = $('note-text');
  const status = $('note-status');
  const text = (input.value || '').trim();
  if (!text) { status.textContent = 'Write a little something first.'; return; }
  state.noteBusy = true; $('note-save').disabled = true; input.disabled = true;
  $('note-save').textContent = 'Saving…';
  const result = await api(state.token, '/api/journal', {
    method: 'POST', body: JSON.stringify({text}),
  }).catch(() => ({error: 'unreachable'}));
  state.noteBusy = false; $('note-save').disabled = false; input.disabled = false;
  $('note-save').textContent = 'Save entry';
  if (result.error || !result.data || !result.data.ok) {
    status.textContent = 'That note did not save. It is still in the box so you can try again.';
    return;
  }
  input.value = '';
  status.textContent = 'Saved to your journal.';
  await loadPart('journal', '/api/journal?n=100', () => { renderToday(); renderJournal(); });
}
$('note-save').addEventListener('click', saveNote);
$('note-text').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); saveNote(); }
});
for (const button of document.querySelectorAll('.chip-btn')) {
  button.addEventListener('click', () => {
    const input = $('note-text');
    if (!input.value) input.value = button.getAttribute('data-prefill') || '';
    input.focus();
  });
}
$('svc-add').addEventListener('click', async () => {
  const nameInput = $('svc-name'); const urlInput = $('svc-url');
  const status = $('svc-status');
  const name = nameInput.value.trim(); const url = urlInput.value.trim();
  if (!name || !url) { status.textContent = 'Add both a name and an address.'; return; }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
  } catch (error) {
    status.textContent = 'Use a complete http or https address.'; return;
  }
  const current = state.apps && Array.isArray(state.apps.data) ? state.apps.data : [];
  const next = current.concat([{
    id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), name, url,
  }]);
  $('svc-add').disabled = true; $('svc-add').textContent = 'Adding…';
  const result = await api(state.token, '/api/apps', {
    method: 'PUT', headers: {'X-PW-StepUp': '1'}, body: JSON.stringify({apps: next}),
  }).catch(() => ({error: 'unreachable'}));
  $('svc-add').disabled = false; $('svc-add').textContent = 'Add service';
  if (result.error || !result.data || !result.data.ok) {
    status.textContent = 'That service was not added. Check the address and try again.';
    return;
  }
  nameInput.value = ''; urlInput.value = '';
  status.textContent = 'Service added.';
  await loadPart('apps', '/api/apps', renderToday);
});
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
/* ---- Auto-login from localStorage ---- */
const savedToken = localStorage.getItem('pw_token');
if (savedToken) {
  $('token').value = savedToken;
}
syncRoute();
load();
/* ---- Chat Provider ---- */
async function renderChatProvider() {
  const info = $('chat-provider-text');
  if (!info) return;
  const res = await api(state.token, '/api/chat/providers');
  if (res.error || !res.data || !res.data.ok) {
    info.textContent = 'Chat provider: unavailable';
    return;
  }
  const d = res.data.data || {};
  const providers = d.providers || [];
  const active = d.active;
  const activeProv = providers.find(p => p.name === active);
  if (activeProv) {
    info.textContent = 'Chatting with ' + activeProv.display_name + ' (' + activeProv.status + ')';
  } else if (providers.length === 0) {
    info.textContent = 'No chat provider configured — add one in Settings';
  } else {
    info.textContent = 'Chat provider: ' + (active || 'none active');
  }
}
/* ---- Vault ---- */
async function renderVault() {
  const statusDiv = $('vault-status');
  const unlockDiv = $('vault-unlock');
  const contentDiv = $('vault-content');
  const res = await api(state.token, '/api/vault/status');
  if (res.error) { statusDiv.textContent = 'Vault unavailable.'; return; }
  const d = res.data && res.data.data || {};
  if (d.locked) {
    statusDiv.textContent = 'Vault is locked. Enter your passphrase to unlock.';
    unlockDiv.style.display = 'block';
    contentDiv.style.display = 'none';
  } else {
    statusDiv.textContent = 'Vault is unlocked.';
    unlockDiv.style.display = 'none';
    contentDiv.style.display = 'block';
    renderVaultNames();
  }
}
async function renderVaultNames() {
  const list = $('vault-list');
  const res = await api(state.token, '/api/vault/names');
  if (res.error) { list.textContent = 'Failed to load.'; return; }
  const names = (res.data && res.data.data && res.data.data.names) || [];
  clear(list);
  if (names.length === 0) { list.appendChild(el('p', 'No secrets stored yet.')); return; }
  for (const name of names) {
    const row = el('div'); row.className = 'prefs-row';
    row.appendChild(el('span', name));
    const btn = el('button', 'Delete');
    btn.addEventListener('click', async () => {
      await api(state.token, '/api/vault/' + encodeURIComponent(name), {method: 'DELETE'});
      renderVaultNames();
    });
    row.appendChild(btn); list.appendChild(row);
  }
}
$('vault-unlock-btn').addEventListener('click', async () => {
  const pass = $('vault-pass').value;
  if (!pass) return;
  const res = await api(state.token, '/api/vault/unlock', {
    method: 'POST', body: JSON.stringify({passphrase: pass})});
  if (res.error) { $('vault-status').textContent = 'Unlock failed: ' + res.error; return; }
  $('vault-pass').value = '';
  renderVault();
});
$('vault-set-btn').addEventListener('click', async () => {
  const name = $('vault-name').value.trim();
  const value = $('vault-value').value;
  if (!name || !value) return;
  const res = await api(state.token, '/api/vault/set', {
    method: 'POST', body: JSON.stringify({name, value})});
  if (res.error) { $('vault-status').textContent = 'Store failed: ' + res.error; return; }
  $('vault-name').value = ''; $('vault-value').value = '';
  renderVaultNames();
});
/* ---- Themes ---- */
async function renderThemes() {
  const host = $('settings-themes');
  const res = await api(state.token, '/api/themes');
  if (res.error) { host.textContent = 'Themes unavailable.'; return; }
  const packs = (res.data && res.data.data) || [];
  clear(host);
  for (const p of packs) {
    const row = el('div'); row.className = 'prefs-row';
    const label = el('label', p.display_name || p.name);
    const btn = el('button', 'Select');
    btn.addEventListener('click', async () => {
      await api(state.token, '/api/prefs', {
        method: 'PUT', body: JSON.stringify({companion: p.name})});
      applyCompanion(p.name);
      setMsg('Companion changed to ' + p.display_name);
    });
    row.appendChild(label); row.appendChild(btn); host.appendChild(row);
  }
}
/* ---- Chat Providers ---- */
async function renderChatProviders() {
  const host = $('settings-chat-providers');
  const res = await api(state.token, '/api/chat/providers');
  if (res.error || !res.data || !res.data.ok) {
    host.textContent = 'Chat providers unavailable.';
    return;
  }
  const d = res.data.data || {};
  const providers = d.providers || [];
  const active = d.active;
  clear(host);
  if (providers.length === 0) {
    host.appendChild(el('p', 'No chat providers configured. Add an opencode, ollama, or openai_compat connection to config/connections.json.'));
    return;
  }
  for (const p of providers) {
    const row = el('div'); row.className = 'prefs-row';
    const label = el('label', p.display_name + ' (' + p.status + ')');
    const btn = el('button', p.name === active ? 'Active' : 'Switch');
    if (p.name === active) {
      btn.disabled = true;
      btn.style.borderColor = 'var(--accent-primary)';
      btn.style.color = 'var(--accent-primary)';
    } else {
      btn.addEventListener('click', async () => {
        // For now, the first healthy provider is active.
        // Switching requires changing connections.json and restarting.
        setMsg('To switch providers, edit config/connections.json and restart.');
      });
    }
    row.appendChild(label); row.appendChild(btn); host.appendChild(row);
  }
}
/* ---- Reminders ---- */
async function renderReminders() {
  const host = $('settings-reminders');
  const res = await api(state.token, '/api/reminders');
  if (res.error) { host.textContent = 'Reminders unavailable.'; return; }
  const reminders = (res.data && res.data.data) || [];
  clear(host);
  if (reminders.length === 0) { host.appendChild(el('p', 'No reminders set.')); return; }
  for (const r of reminders) {
    const row = el('div'); row.className = 'prefs-row';
    const timeStr = r.cron_hour != null ? String(r.cron_hour).padStart(2,'0') + ':' + String(r.cron_minute || 0).padStart(2,'0') : 'any time';
    const dayStr = r.cron_day || 'daily';
    row.appendChild(el('span', r.text + ' (' + dayStr + ' ' + timeStr + ')'));
    const toggle = el('button', r.enabled ? 'Disable' : 'Enable');
    toggle.addEventListener('click', async () => {
      await api(state.token, '/api/reminders/' + r.id, {
        method: 'PATCH', headers: {'X-PW-StepUp': '1'},
        body: JSON.stringify({enabled: !r.enabled})});
      renderReminders();
    });
    const del = el('button', 'Delete');
    del.addEventListener('click', async () => {
      await api(state.token, '/api/reminders/' + r.id, {method: 'DELETE', headers: {'X-PW-StepUp': '1'}});
      renderReminders();
    });
    row.appendChild(toggle); row.appendChild(del); host.appendChild(row);
  }
}
$('reminder-add').addEventListener('click', async () => {
  const text = $('reminder-text').value.trim();
  if (!text) return;
  await api(state.token, '/api/reminders', {
    method: 'POST', headers: {'X-PW-StepUp': '1'},
    body: JSON.stringify({text: text, cron_hour: 9, cron_minute: 0})});
  $('reminder-text').value = '';
  renderReminders();
});
/* ---- Quick actions ---- */
function renderQuickActions() {
  const sec = document.getElementById('today-attention');
  if (!sec) return;
  const qaDiv = el('div'); qaDiv.style.cssText = 'margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap';
  const actions = [
    {label: 'Record fact', prompt: 'Fact key:', api: '/api/world/fact'},
    {label: 'Set intent', prompt: 'Intent key:', api: '/api/world/intent'},
    {label: 'Add policy', prompt: 'Policy key:', api: '/api/world/policy'},
  ];
  for (const a of actions) {
    const btn = el('button', a.label);
    btn.addEventListener('click', async () => {
      const key = prompt(a.prompt);
      if (!key) return;
      const value = prompt('Value:');
      if (value === null) return;
      const body = a.api.includes('policy')
        ? {key, effect: value || 'allow'}
        : {key, value};
      await api(state.token, a.api, {method: 'POST', body: JSON.stringify(body)});
      setMsg(a.label + ': ' + key + ' saved');
      load();
    });
    qaDiv.appendChild(btn);
  }
  sec.appendChild(qaDiv);
}
/* ---- Gitea rollups in World ---- */
async function renderGiteaRollups() {
  const src = $('world-src');
  const res = await api(state.token, '/api/source-control/rollups');
  if (res.error || !res.data || !res.data.ok) return;
  const rollups = (res.data.data && res.data.data.rollups) || [];
  if (rollups.length === 0) return;
  const h = el('h3', 'Recent activity');
  src.appendChild(h);
  for (const r of rollups) {
    const p = el('p', r.repo + ': ' + r.commit_count + ' commits — ' + (r.last_commit || 'no commits'));
    src.appendChild(p);
  }
}
</script>
</body>
</html>
"""
