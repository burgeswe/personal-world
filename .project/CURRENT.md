# Current State — Project Worlds

**This is the canonical current-state pointer for this project**, per
the Play-Nice `stable-truth-replaceable-machinery` rule ("one canonical
current truth; other documents may point to it"). `STATUS.md` and
`.agent/STATE.md` were retired to point here 2026-09-12 after being
found stale and mutually inconsistent. This file routes — canonical
truth lives in the files it names. When this file and a canonical file
disagree, the canonical file wins.

Verified 2026-09-12 by bcode/claude (evidence: `git log`/`git
merge-base`/`git rev-parse` against the real GitHub repository, `gh pr`
CI status, `contractctl` tool output, live CDP-driven browser checks —
not memory, not narrative).

## Identity

- **Product name:** Project Worlds (renamed from "Personal World"
  2026-09-12 — a product re-anchoring, not a new codebase; see
  "Identity pass" below for exactly what did and didn't change).
- **Repository / package / CLI identifiers:** unchanged
  (`Rylee-Bee/personal-world`, `personal_world` Python package,
  `personal-world` CLI command, `personal-world-frontend` npm package).
  Renaming these is a separate, deliberately deferred migration — it
  breaks remotes, automation, links, and external state, and nothing
  about the product rename requires it yet.
- **North Star:** "Project Worlds is a calm, accessible, slightly
  whimsical personal environment where my information, tools,
  assistant, history, and capabilities come together naturally — and
  where sophisticated machinery stays out of my way until I actually
  need it." Dual acceptance test: understandable at a glance when
  barely able to focus; fully inspectable down to the technical guts on
  demand. Calm does not mean shallow — complexity is available on
  demand, not forced into the default experience.

## Trunk

**One canonical trunk: `main`.** Unified 2026-09-12 by merging, in
order (preserving full commit ancestry, not squashed, not
cherry-picked):

1. PR #22 (`p1/integration`, T10–T13 screens/tests) → `main` at
   `ba2ae6cae2cfb3919dce69b70f6bb9c9de07d9ea` (merge commit).
2. PR #24 (`uat/t14-warmth`, T14 composition/a11y convergence +
   Play-Nice context, itself built directly on PR #22's tip) → `main`
   at `70ab495890b5ba73a429876a029134e8bed00615` (merge commit).

Both merges were verified independently after landing, not assumed from
green PR checks alone: `main` @ `70ab495` passes 511/511 backend tests,
291/291 frontend tests, clean build, clean lint, `tokens:check` clean,
`framework validate` healthy, and both accessibility fixes (see below)
were re-confirmed live via CDP-driven headless Chrome against this exact
merged state — not just via source inspection.

`uat/t14-warmth` and `p1/integration` are now fully contained in `main`
and can be deleted. No other branch needs to be reconciled into this
trunk as of this pass.

## What works today

See `README.md` "What makes it different" / architecture docs for the
durable description. As of this trunk: legacy server-rendered dashboard
+ full React frontend (Today, Interests, Media, Projects, Lab, Chat,
Journal, Vault, World, Settings, Login, Setup) with real headings and
no card-chrome composition drift on Today/Journal/Vault; the two
previously-shipping accessibility bugs below are fixed everywhere, not
just on the branch that found them.

**Projects workspace v1 (2026-09-12, `35204b6` + `dff360f`):** the Projects
section now renders the REAL repository table from the native
source-control baseline (`GET /api/source-control/status`): one row
per discovered repo with branch, dirty/ahead/behind, last commit; a
quiet glance line (counts only; clean stays quiet); per-repo
provenance (path/revision/remote) and recent-commit drill-in
(`GET /api/source-control/history`). Selecting a repo is a shareable
`?repo=` deep link, and the World Assistant context carries it as the
observed selected entity ("looking at personal-world"). No search
paths configured → the same honest EmptyState + knob as before. The
e2e fixture points the baseline at the repo itself, so CI exercises
real git — no fabricated rows anywhere. Frontend type now mirrors the
backend `repository_status()` exactly (9 previously-dropped fields
recovered).

**Journal audit trail (2026-09-12, `fd5c519`):** the Journal screen
gained a lazy Level-4 "Audit trail" disclosure — the backend
AuditRenderer's full technical log (provenance on every line), shown
verbatim on request; zero fetches in the calm default view. Finishes
the "understand exactly what happened" + nerd-mode transparency rows
for journal.

**Journal correction/supersede workflow (2026-09-12, `c563efd`,
second propose→approve→act workflow):** any journal entry can be
corrected without erasing it. "Correct this entry" opens an inline
approval panel (original vs proposed, effect/risk/recovery, "Nothing
has changed yet"); explicit approval appends a corrected entry that
links back via `supersedes` — the original row is NEVER rewritten
(append-only NDJSON; currency is derived from links). The calm view
shows only current versions; each corrected entry carries a "Corrected"
note and a "View history" disclosure exposing the full chain with
reasons and timestamps. Idempotent retries (same target + same text →
already-applied, no duplicate); conflicting second corrections are
rejected honestly; failures leave the original current. Every
correction journals an APPROVAL audit event answering what/old/new/
proposer/approver/reason/mechanism/when. Repeated corrections are
linear (A→B→C; branching rejected). Backend tests (11) + frontend
tests (6) + live 10-point browser walkthrough incl. keyboard, focus
ring, 200% reflow, reduced motion.

**Gitea retirement + GitHub enrichment + public README/screenshot
pass (2026-09-12, slice complete):** Gitea is retired from the live
architecture. `GiteaEnrichment` and `/api/source-control/rollups` are
removed (the endpoint 404s); the generic forge adapter in `adapters.py`
remains as substitution-proof registry machinery, no longer a
supported live provider; `GITEA_TOKEN` is gone from compose and
examples; GitHub is the supported remote enrichment provider.
Model: LOCAL GIT TRUTH (canonical: existence, branch, dirty,
ahead/behind, local history) + OPTIONAL GitHub enrichment
(`providers/github.py` — read-only `gh api` argv calls over the host's
existing authenticated gh session; NO credential management in the
app; structured `unavailable`/`not_github`/`not_configured` states;
`not_github` answered from the local remote URL without needing gh).
Surface: `GET /api/source-control/enrichment?repo=<name>` + the
Projects drill-in "GitHub activity" disclosure (open PRs, open
issues, remote default branch, last remote push, canonical slug/url
with per-field provenance). Quiet degradation verified live WITH and
WITHOUT gh: absent → one sentence, native table untouched.
README rewritten for public landing (screenshots at top, honest
what-works-today, quick start with real clone URL Rylee-Bee/personal-world,
deeper-docs table); five sanitized screenshots under
`docs/screenshots/` captured from the real running app on a fixture
demo world (`demo-world` repo + seeded garden/fig-tree journal entries
with one corrected entry showing the history chain). Safety audited:
no tokens, no hostnames/IPs, no private repos (octocat/Hello-World is
intentionally public), no browser chrome leaks, demo commits re-
authored to "Demo Person". Historical Gitea references preserved in
CHANGELOG/ADR/DESIGN-HANDOFF/completion-plan; current-architecture
docs (ARCHITECTURE, NATIVE-BASELINE, PROVIDERS, ROADMAP, AGENT_POLICY
context) updated; NATIVE-BASELINE anti-pattern illustrations kept
(conceptual, still truthful).

**First propose→approve→act workflow (2026-09-12, `1152301`):**
from a selected repository on Projects, the screen proposes a
read-only status re-check and explains WHAT/WHY/TOOL/RISK/EXPECTED;
nothing runs before the explicit "Approve and refresh" button. The
act is `POST /api/source-control/refresh` (step-up gated) which
re-runs the native git status for that repo and journals a
PROVIDER_ACTION audit event answering who proposed, what was
approved, which tool ran, what came back, and when. The panel shows
explicit has/has-not-happened state through proposed→running→done/
failed; repeated use re-proposes rather than auto-running. This is
the FIRST approval workflow only — the pattern (not an engine) for
later, higher-risk actions.

**Context-aware World Assistant (2026-09-12, implementation run
`ac9c18d`):** the Drawer-hosted assistant now knows which section it
was opened from. The shell derives route/section (GET /api/sections
registry supplies the label) and POST /api/chat accepts an optional
`context` envelope rendered into the system prompt as observed UI
location — provenance, never authority: unknown sections degrade to
honest "unknown", malformed context never breaks conversation, and
the standalone /chat route stays the global surface. The panel shows
"You opened this from <section>" and swaps in section-local
conversation starters. Backend 517 tests, frontend 293, e2e 42/42
incl. axe; live-browser verified on /journal, /vault, /chat.

**Two accessibility bugs fixed and verified on this exact trunk**
(both were live/shipping on old `main` before this unification — not
hypothetical):
- Invisible keyboard focus ring: `design/tokens.json`'s `focus.ring` was
  an unresolved token reference plus invalid `outline` shorthand syntax;
  browsers silently dropped the whole declaration. Fixed to a literal
  resolved value; `tests/test_design_tokens.py` now checks real CSS
  validity, not a placeholder string.
- OS `prefers-reduced-motion` silently overridden by a saved "subtle"
  motion preference in the React port (JS inline styles beat the
  non-`!important` CSS media-query rule). Fixed in
  `frontend/src/lib/prefs-context.tsx` to check `matchMedia` and force
  the reduced tier unconditionally, with a live-change listener.

## Design truth

`design/tokens.json` (canonical tokens; repo-owned), `docs/DESIGN-HANDOFF.md`
(V0.1 baseline reference, partly superseded), `docs/accessibility/`
(non-negotiable floor). `design/handoff/` is an archived Figma spec
package — historical, never edit to change design. `design/CURRENT.md`
(top-level `.project/design/CURRENT.md`) answers "what is approved right
now" in more detail, including frame-by-frame approval status.

## Play-Nice adoption

Pinned to **v0.6.0** @ `21b6841a50a1b0d459a760861385e99679852430`
(`.project/contracts/adoption.yaml`) — bumped from v0.5.0 during this
same pass (which itself had been bumped from v0.3.0). Delta at this
bump: new `collaborative-good-faith` contract (always-applicable); four
contracts already adopted changed version
(`ask-for-help`→1.3.0, `mutual-contribution`→1.1.0,
`participation-and-contribution`→1.2.0, `orchestration`→1.4.0). Gate
**PASS**, commitment **ACTIVE** for task
`project-worlds-trunk-unification` (session artifact under the
gitignored `.contracts/`). Verified with the real `contractctl` tool
(cloned at the pinned revision): `adopt`, `project validate`, and
`participant validate` all pass.

## Figma participant pack

`.project/participants/figma/` — status: **accepted** (contract gate
PASS; commitment ACTIVE), but her attestation is scoped to the bundle
she actually read (revision `0c0ab7c5`, v0.3.0) — now three bumps
behind the current v0.6.0 pin. Not fabricated forward on her behalf;
see `figma/contract-return/NEXT-REVISION-NOTE.md` for the exact,
non-blocking gap and the tiny re-pass needed if a live Figma session
becomes available. This does not block anything: participant packs are
enrichment, never canonical project truth.

Her pack's **participant relationship** (design-service role,
authoritative_for/not_authoritative_for boundaries, help routing) is
unaffected by the product rename and was not touched. Her
**project-specific references** (`references.yaml`: file
`VATVojyJZT9HKx0CrDS0yr`, frame IDs) were reviewed during this identity
pass and left as-is — they describe the same design file and the same
screens; nothing about renaming the product invalidates them. If a
future Figma session finds the file/frame identity itself has changed,
mark the specific reference `unknown`/`stale` at that point rather than
assuming now.

## Identity pass (2026-09-12): what changed vs what intentionally didn't

Audited references to "Personal World" / "personal-world" /
"PERSONAL-WORLD" across the repo (~85 files matched a grep). Did **not**
blindly rename all of them. Classification used:

- **Updated (human-facing product identity):** `README.md` (title,
  tagline, "Why it exists"), `.project/project.yaml` (`name` +
  `purpose.summary`), `.project/README.md`, this file.
- **Left unchanged — technical/repository identifiers** (renaming is a
  separate, deliberately deferred migration per explicit instruction):
  `pyproject.toml` (`name = "personal-world"`), the `personal_world`
  Python package, the `personal-world` CLI command, `frontend/package.json`
  (`personal-world-frontend`), `compose.yaml`, `config/`, CI workflow
  files, the GitHub repo slug itself.
- **Left unchanged — character identity, not product identity:**
  "Personal World" is also the proper name of one of the five companion
  residents (the default/generic mascot — see
  `design/COMPANION_INTEGRATION.md`, `design/assets/companions/personal-world/`).
  This is a deliberate, separate naming choice (the default companion
  shares its name with the product by design) and was NOT renamed —
  conflating a character's name with the product name would be a content
  bug, not an identity update. Flagged here as a genuine open question
  the product owner may want to resolve later (does the default
  companion get renamed too, or does it keep its established identity
  regardless of product branding?) — **not decided in this pass.**
- **Left unchanged — historical documents:** `CHANGELOG.md` entries,
  `design/handoff/*` (archived Figma spec package), `docs/p1/FOUNDATION-SPEC.md`,
  ADRs, dated handoffs. These remain truthful to the period they
  describe; rewriting them would falsify history for no benefit.
- **Identity cleanup complete (2026-09-12, second pass):** the
  deferred policy-doc prose above was updated in a bounded follow-up
  pass (`docs/ACCESSIBILITY_CONTRACT.md` → under
  `docs/accessibility/`, `ARCHITECTURE.md`,
  `HUMAN_RELIABILITY_CONTRACT.md`, `PERSONAL-WORLD-FINISH-LINE.md`,
  `PERSONAL-WORLD-COMPLETION-PLAN.md`, `INDEX.md`, `NATIVE-BASELINE-
  AND-ENRICHMENT.md`, `OPERATIONS.md`, `PROVIDERS.md`, `DESIGN-HANDOFF.md`,
  `ROADMAP.md`, `SECURITY.md`, `README.md`, `AGENT_POLICY.md`,
  `AGENT_CONTRACTS.md`, `CONTRIBUTING.md`, `frontend/README.md`, current
  `design/` docs, issue templates, `compose.yaml` header comment). Each
  occurrence was classified first; rule/technical content is unchanged.
- **Runtime brand pass COMPLETE (2026-09-12, `1152301`):** every
  PRODUCT-BRAND runtime string now says "Project Worlds" — the shell
  brand lockup, login h1, setup headings + default world name ("My
  Project Worlds"), SPA/index titles, legacy dashboard titles and
  error copy, chat provenance/footnote, FastAPI title, theme-pack
  author. COMPANION references intentionally keep "Personal World"
  (companion selection lists, "A conversation with Personal World"
  humanizers, companion-context names). TECHNICAL IDENTIFIERS and
  HISTORICAL TEXT unchanged, as before.
- **Historical Personal World references intentionally retained:**
  `CHANGELOG.md`, `docs/adr/`, `docs/p1/FOUNDATION-SPEC.md`,
  `design/handoff/` (archived Figma package), `docs/FIGMA-HANDOFF-LESSONS.md`,
  dated postmortems (`design/SVG_POLISH_NOTES.md`), the
  `PERSONAL-WORLD-*` **filenames** and their cross-links (stable
  identifiers, not prose), the screen-reader walkthrough's observed
  `Personal World — <page>` runtime title pattern (it describes the
  built interface), and every technical identifier. These are legitimate
  history or deliberate stability, not stale prose.
- **Technical identifiers intentionally remain `personal-world`:** repo
  slug, Python package, CLI command, npm package, compose service
  names, schema URIs (`personal-world/…`), CI images, config paths.
  Renaming any of these is a separate future migration decision.
- **New product work may begin** — trunk unified, identity cleanup
  complete; the only open identity question is the companion name below
  (which does not block product work).

## In-flight / untracked

`frontend-v2/` and `.bcode/` are pre-existing local experiments,
unrelated to any pass, still untouched.

## UNKNOWN

- **RESOLVED (owner decision, 2026-09-12): the companion keeps the
  name "Personal World".** Interpretation: "Project Worlds is the
  environment. Personal World is the companion inside it." The
  character, her slots/artwork/rig, the companion-selection lists, and
  the "A conversation with Personal World" journal humanizers all keep
  her name. This unblocked the runtime brand pass (below).
- Whether/when the repository slug, Python package, and CLI command
  should follow the product rename — explicitly deferred, not decided
  (same for runtime UI strings; see identity-pass section).
- Live production/deployment state of this trunk outside this checkout
  — not verified this pass (local + CI evidence only).

## Remaining implementation gaps (surveyed 2026-09-12, implementation run)

Everything below needs owner input, external infrastructure, or a
product decision — not silently guessable from repo truth:

- **Further approval workflows:** two are now proven (repository
  status refresh; journal correction/supersede). Journal cleanup
  capabilities NOT yet implemented: bulk deletion (deliberately —
  deletion is a separate owner decision), mass corrections, retention
  policy, and assistant-drafted correction suggestions (the endpoint
  would accept them, but no assistant proposal UI exists yet). Destructive
  Git actions remain out of scope until the owner says otherwise.
- **Interests / Candy Dispenser and Media sections**: require real
  discovery/media provider connections (external infrastructure) or
  explicit interest-feed configuration; honest EmptyStates remain until
  then. Feed-building-via-chat is design work.
- **SSO / provider-neutral authentication**: a secure real-world path
  needs a chosen identity provider (Authelia or other) and deployment
  decisions — security-sensitive, owner-scoped.
- **Legacy dashboard deletion (T15-style cutover)**: the legacy
  server-rendered UI remains the `PW_FRONTEND` default; flipping the
  default/deleting legacy is an owner gate.
- **Lab repair workflows, dependency/topology, service config UI**:
  depend on the real Lab CLI deployment and what homelab operations
  Rylee wants surfaced; backend routes exist for several but the
  product shape is owner input.
- **Runtime UI brand strings** still say "Personal World" in places —
  deliberately deferred pending the companion-name decision above.
