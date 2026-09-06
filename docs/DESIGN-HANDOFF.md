# Personal World — Design Handoff (V0.1)

**For: the Figma design stage.** This document describes the ACTUAL
implemented product as of V0.1 (commit `1f4e404`+). It is sanitized:
no credentials, no tokens, no personal journal contents, no private
lore, no real indexer/client names. All examples below are either
real structural output or clearly synthetic.

Give this document plus the V0.1 final report to ChatGPT to produce
the Figma implementation brief.

---

## A. Product purpose

Personal World is Rylee's **world-centric personal dashboard and
control surface** — the front door to her lab, designed to answer
*her* questions ("what matters today?") rather than to list
installed services.

- **Serves:** exactly one person (Rylee) plus her AI agents. Not
  multi-tenant, not a public product, but built on generic open-source
  core so the design must not hard-code Rylee into it.
- **Makes easy:** one-glance world health, what needs attention,
  what changed, what her world discovered for her, and safe common
  actions — with all machinery (Gitea, Traefik, Komodo, gatus,
  Plex, candy-dispenser...) appearing as supporting cast, not as the
  navigation model.
- **Operator vs personal presentation:** today they are the same
  person. The world-centric hierarchy (section A.1) is the personal
  mode. Deep specialist operations (full Git client, Plex admin,
  Traefik configurator) are **delegated** — linked out, never
  recreated. Rule: *native when the task is about the user's World;
  delegate when the task is about operating the provider itself.*

### A.1 Product direction (binding for design)

Personal World should be designed as a coherent personal
dashboard/control surface, **not as a prettier service launcher or
collection of embedded third-party admin panels.** Do NOT design the
IA around "one installed service = one card." The desired conceptual
hierarchy (final ordering is a design decision, not this list):

```text
TODAY        — what matters to me right now?
ATTENTION    — what actually needs me?
WORLD HEALTH — is my world okay?
CHANGES      — what changed?
ACTIVE THINGS— what am I working on / using?
DISCOVERY    — what did my world find for me?
QUICK ACTIONS— what can I do from here?
JOURNAL      — what has happened over time?
APPS/SERVICES— where are the specialist tools when I need them?
```

An Apps/Services surface still exists — for launching specialist
applications and provider diagnostics — but it is the bottom of the
hierarchy, not the primary model. The existing homepage service
launcher stays until Personal World proves itself through
dogfooding; Personal World neither depends on it nor reproduces it.

---

## B. Actual information architecture (implemented today)

Single-page app at `/`, hash-routed. Server: FastAPI. No JS
framework; one HTML template string in `src/personal_world/api.py`
(`DASHBOARD_HTML`). All data via the same `/api/*` the CLI uses.

| Route | Purpose | Status | Primary tasks | Data source |
|---|---|---|---|---|
| `#today` (default) | daily briefing | implemented | glance health, attention list, recent journal | `/api/status`, `/api/daily`, `/api/journal?n=5` |
| `#world` | world state | implemented | inspect facts/intents/lore/actors | `/api/exports/world`, `/api/actors` |
| `#journal` | full history | implemented | read event history | `/api/journal?n=20` |
| `#settings` | exportable settings | implemented | review whitelist-safe settings | `/api/exports/settings` |
| — (nav) | Apps/Services, Quick Actions, Schedules | **not implemented** | — | future surface (see Q) |

Every view renders only real API response fields. Nothing on screen
is fake.

---

## C. Actual API/state model (UI-facing shapes)

Envelope everywhere: `{ok, status, changed, warnings, actions, data}`.

**GET /api/status → data:**

```json
{
  "facts": 13, "intents": 0, "policies": 0,
  "cemented_policies": 0,
  "lore": {"confirmed": 0, "derived": 0, "suggested": 0, "ephemeral": 0},
  "providers": 0, "packs": 0,
  "capabilities": {
    "memory": {"ok": true, "status": "healthy", "warnings": []},
    "discovery": {"ok": true, "status": "healthy", "warnings": []},
    "secrets": {"ok": false, "status": "not_configured", "warnings": []}
  },
  "actors": [
    {"name": "gitea", "role": "source_control", "provider": "gitea",
     "capabilities": ["source_control"], "status": "healthy",
     "secrets": "none", "writes": "none"}
  ]
}
```

**GET /api/daily →** envelope + `data: {world, capabilities,
attention[]}` where `attention` is a list of short strings (drift
items, provider states, "available not enabled" hints). Journal
events recorded during the run are retrievable via `/api/journal`.

**GET /api/journal?n= → data: [event]:**

```json
{"ts": "...", "kind": "observation", "summary": "capability x: healthy",
 "provenance": {"source": "daily-loop", "observed_at": "...",
                "provider": null, "authority": "observed"},
 "classification": "private"}
```

Kinds: `observation, health, drift, recommendation, approval,
reconciliation, provider_action, failure, pack_change,
settings_change, security, discovery`.

**GET /api/exports/world →** full facts/intents/policies/lore with
classification field on each record.

**GET /api/exports/settings →** whitelist-safe only:
`{schema, capabilities, packs, policies, accessibility}` — private
and secret material is structurally unable to appear.

**Memory search** `GET /api/memory/search?q=...` → provider-backed
recall results (private class; results are personal context).

**World concepts, not provider internals:** where a provider
surface exists, the API exposes semantic capability health
("discovery: healthy") rather than raw provider objects. Known gaps
recorded as design dependencies (section Q): e.g. no "ingress: 14
routes healthy / 1 cert needs attention" rollup yet — Traefik data
is not yet a capability.

---

## D. Status vocabulary (semantic, never color-only)

| State | Meaning |
|---|---|
| `healthy` | observed ok right now |
| `warning` | usable, something off |
| `unknown` | no data — NOT healthy, NOT failed |
| `needs_attention` | real problem, actionable |
| `unavailable` | provider unreachable/unresponsive — not necessarily failed |
| `stale` | observation too old to trust (explicit freshness contract) |
| `disabled` | configured off by user |
| `not_configured` | no provider wired — a vacancy, not a failure |

Rank (worst wins): healthy < warning < unknown < needs_attention <
unavailable < stale < disabled < not_configured. The UI MUST show the
status word; color (any tint) is reinforcement only.

---

## E. User actions

| Action class | Today | Confirmation | Notes |
|---|---|---|---|
| Read (status/daily/journal/exports) | implemented, zero mutation | none | all views read-only |
| Memory search | implemented | none | read-only recall |
| Daily loop run | implemented (on request via GET /api/daily) | none | journals observations |
| Lore promote to confirmed | CLI `cement` | explicit UserAction flag | user-only; AI can never |
| Cemented policy change | CLI | explicit UserAction flag | user-only |
| Pack install | CLI | normal | never overwrites user policy |
| Provider writes | none enabled (writes="none" everywhere) | — | future step-up-auth candidates |
| Settings write | not implemented | — | future |

Future step-up-auth candidates (not built): policy changes, provider
writes, secrets-broker use.

---

## F. Authentication experience

- **Unauthenticated browser** → Authelia SSO login (302 to the
  lab's auth portal, one_factor password, group:users).
- **After SSO** → dashboard shell loads; an inner bearer-token field
  gates `/api/*` (the proxy is never the only gate). Token persists
  in the browser session only.
- **Wrong/missing inner token** → inline "Authentication failed —
  check the token." (API returns 401; unconfigured server returns
  503 with "Auth not configured on the server.")
- **Backend down** → "Personal World is unreachable — the core may
  be down." (network error text).
- **Session failure** → API calls begin 401-ing; shell shows the
  auth-failed message again.
- **Future elevated auth** → arrives as Authelia policy change
  (two_factor for `world.*`), not new core code. Keep the flow
  design compatible with an SSO re-prompt without page redesign.

---

## G. Empty/loading/error states (design all of these)

- First run / empty world: all capabilities `not_configured`,
  "No providers connected yet." — world counts all zero
- No journal: "No journal entries yet."
- No attention items: "Nothing needs your attention."
- No lore / no facts: "World is empty — no facts or intents recorded yet."
- Provider loading: brief fetch window; status region shows "Loading…"
- Provider unavailable: capability row shows the status word
  `unavailable` — not an error page; the rest of the dashboard stays
- Partial data: per-capability states can differ in one view
- Stale data: `stale` status (V0.1: schema + API support; the
  dashboard does not yet render a "last observed" age — design
  dependency, see Q)
- Core error: full-page shell message (unreachable text)

---

## H. Accessibility contract (NON-NEGOTIABLE — the owner has
hemiplegic migraines, cluster headaches, dyslexia, arthritis)

Implemented today (all verified in tests):

- Landmarks: `header`/`nav aria-label`/`main`; skip-to-content link
  first in tab order; `aria-labelledby` sections; one h1, no skipped
  heading levels
- Keyboard: all interactive elements tab-reachable; visible
  `:focus-visible` 2px outline; no traps; Enter activates
- Targets ≥ 44x44 CSS px everywhere
- Status = words, never color-only
- `prefers-reduced-motion: reduce` honored globally (nothing animates
  until opted in; motion OFF by default)
- No text block > 3 lines outside disclosure/list; long strings
  wrap (`overflow-wrap: anywhere`); no horizontal page scroll
  (tables scroll inside labeled regions)
- `role="status" aria-live="polite"` load/result messaging
- Dark default; low-saturation light override via
  `prefers-color-scheme`
- Useful title ("Personal World — Today"), meaningful error text

Design must add: reading-load shaping (tables/lists over prose),
static layouts (predictable shape/position), no ALL-CAPS headers
(dyslexic word-shape flattening), font floor ~14px, and honor the
accessibility preference schema below.

**Accessibility preference schema** (in world/settings-export; the
presentation layer is one implementation of it — a theme must not
be the only way these apply):

```json
{"motion": "reduced", "contrast": "normal", "text_scale": 1.0,
 "density": "normal", "targets": "normal"}
```

Future: a secure personal accessibility interview flow (AI
assists/asks, user confirms; preferences portable in the user's own
world export per classification rules; never leak into another
person's template).

---

## I. Responsive requirements

Today: single max-width column (~48rem), works desktop-first, wraps
at narrow widths. No mobile-specific behavior implemented. Design
for: desktop (primary), narrow desktop/tablet (secondary), mobile
(planned — do not invent unsupported mobile interactions).

---

## J. Existing lab visual context (harmonize; do not copy assets)

| Asset | Status | Reference |
|---|---|---|
| `design/rylee-lab/tokens.css` (homelab repo) | **canonical house palette** | aubergine near-black surfaces `#0a0810`/`#12101a`, warm-pale text `#f0eaff`/`#a397b8`, mermaid-teal accent `#72b1b1`, dusty-rose `#b57f8b`, mascot pastels |
| Figma file `kRwOoUtrZsbmB4NfQzxXNR` + `/mnt/c/Users/ryleeb/projects/Figma/` | **canonical design authority** | both VEFR + LRW name it single source of truth |
| `lrw-theme/` (homelab) | canonical artwork (robots/stickers), Outfit/Geist/Geist Mono type | warm charcoal + dusty pink `#b87788` |
| `web/vefr-foundation.css` (vefr repo) | canonical a11y contract | 44px floor, motion-off, Atkinson Hyperlegible Next, contrast as band 8–10:1 (above 10:1 halates), 3 user contrast themes |
| OpenDyslexic (homepage global), Atkinson Hyperlegible (VEFR body) | sanctioned type choices | pick from this set; justify additions |
| Mermaid governance (`mermaid/README.md`) | personality rules | cute = presence (headers, empty states, footers), NEVER status, never animated on dense surfaces, always aria-hidden |

Key hard rules from the house style: contrast is a BAND (8–10:1),
not a floor; blue near 480nm is demoted (photophobia); flat surfaces
(no blur/glow); radius scale 4–16px; 120ms ease-out transitions
only, gated behind no-preference; personality never carries
operational meaning.

**Generic vs Rylee-specific split:** the core repo ships neutral
dark defaults; Rylee's skin (mascots, accents, microcopy) arrives
as a design pack — the Figma brief should specify both the generic
foundation and where the personal layer attaches.

---

## K. Personalization boundary

| Layer | Owns | Examples |
|---|---|---|
| generic core | structure, semantics, a11y contract, status vocabulary | routes, API, schema |
| accessibility preferences | per-user presentation contract | motion, contrast, text_scale, density, targets |
| user theme | colors/type within the a11y contract | house palette |
| Rylee design pack | personality | mascots, microcopy, accent choices |

Figma can make it deeply personal without hard-coding Rylee into
the generic app: personality slots must be pack-provided.

---

## L. Component inventory (implied by current app)

- global navigation (hash links, aria-current)
- Today summary (overall health sentence + counts)
- attention item (list row)
- capability status row (word + neutral border)
- provider/actor card (name, role, status, writes, secrets)
- drift item (intent vs fact mismatch — via daily attention)
- journal event row (time, kind, summary)
- lore entry (value + state word)
- settings table (whitelist export)
- empty state (per section, explicit text)
- error state (inline + full-page variants)
- auth gate (token field + status message)
- status region (aria-live)

Suggested additions for Figma to design (not implemented):
quick-action button, schedule/reminder row, discovery item
(candy results surfaced as world concepts), confirmation dialog
(for future write actions), apps/services launcher grid (bottom of
hierarchy).

---

## M. Data density

| View | Density |
|---|---|
| Today | glanceable — one-screen, status words, ≤5 attention items |
| World | moderately detailed |
| Journal | moderately detailed (dense when long) |
| Settings | operator-dense (tables) |
| future Apps/Services | glanceable grid, bottom of nav |

Do not assume all users want Rylee-level density; the density
preference exists in the schema.

---

## N. Design constraints (hard lines for Figma)

1. Never encode status by color alone — the word is the signal.
2. Never make hover the only way to reveal important information.
3. Preserve keyboard usability and visible focus exactly as built.
4. Respect reduced-motion; nothing animates until opted in.
5. Never expose secrets, tokens, or private lore in any view.
6. Never make dangerous actions visually casual (future write
   actions need weight).
7. Do not turn every datum into a card.
8. Do not bury Today under operational telemetry.
9. No saturated reds/greens on status; luminance-only rank encoding.
10. No ALL-CAPS headers; no walls of text (>3 lines outside
    disclosure).
11. Do not default to a Homarr/Homepage/Heimdall service grid —
    the person's World is the IA, machinery is supporting cast.

---

## O. Reproducing current states locally

```bash
git clone <personal-world repo> && cd personal-world
export PW_API_TOKEN=dev-token
docker compose up -d          # standalone, no lab needed
open http://localhost:8000/    # token: dev-token
```

States to capture for reference: first-run empty world (fresh
volume), healthy-with-providers (add config/connections.json
entries), provider-unavailable (stop a provider), unauthenticated
(SSO redirect in lab; token prompt in dev). Screenshots should be
taken by the designer against a live instance; no screenshots are
embedded here to keep this document shareable.

---

## P. Open design questions (for Rylee + Figma, NOT engineering)

- Visual identity: harmonize with Rylee Lab aubergine/teal, LRW
  warm charcoal/pink, or a new Personal World personality?
- Navigation style: top nav vs sidebar vs segmented tabs?
- Default density: comfortable vs compact?
- Personality: mascot usage (mermaid? a new world-keeper
  character?), microcopy voice?
- Motion language (within the reduced-motion-first contract)?
- Today composition: single column vs bento?
- Operator vs personal mode: one surface or a toggle?
- Accessibility presets as one-click themes?
- How the Apps/Services drawer presents without becoming the IA?

---

## Q. Design dependencies / future engineering requirements
(not yet implemented; do NOT design them as if they exist)

- "Ingress: 14 routes healthy / 1 cert needs attention" style
  rollups — needs a Traefik capability provider (semantic seam
  recorded; the API currently exposes capability health only)
- Source-control concept rollups ("3 repositories changed today")
  — gitea adapter is health-only today
- Scheduler/reminder engine (schema exists; no runner)
- Accessibility-preference → CSS wiring (schema exists; dashboard
  renders defaults)
- "Last observed" age display for stale surfacing
- Quick actions (write-path + step-up-auth groundwork)
- Apps/Services launcher (needs an apps registry concept)
- Interview wizard (onboarding; accessibility-interview flow)

---

## R. Implementation boundaries

- Frontend: server-rendered single HTML string + vanilla JS (no
  framework, no build step, no external assets). Figma output should
  be handed back as design tokens + annotated specs against this
  structure; a future template engine is acceptable, a SPA rewrite
  is not required.
- Styling: inline `<style>` in the template today; design tokens
  should land as a CSS custom-properties file the template imports
  (`design/tokens.json` exists as a starting point).
- What can change freely: layout, type, color (within a11y
  contract), component shapes, copy.
- What must not change: status vocabulary words, the API contract,
  classification semantics, auth flow shape, keyboard/focus
  behavior.

*Sanitized for external design tooling. Contains no secrets, no
tokens, no personal data — synthetic examples only.*