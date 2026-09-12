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
- **Still intentionally old — runtime UI strings:** user-facing strings
  inside the application itself (`src/personal_world/api.py` legacy HTML
  titles/headings, `frontend/src/` screen headings, brand lockup, chat
  footnote, journal/today humanizers, `theme_pack.py` author metadata)
  still say "Personal World". They are runtime code coupled to tests and
  shipped bundles, not prose documentation — renaming them is a
  code-and-tests pass with its own verification cycle, deliberately
  deferred to the owner. The companion character name (below) must be
  settled first so a runtime pass doesn't guess wrong.
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

- **UNKNOWN / OWNER DECISION: Should the companion named "Personal
  World" retain that name?** The default companion character is
  properly named "Personal World" (see
  `design/COMPANION_INTEGRATION.md`, the five-residents table, and
  `design/assets/companions/personal-world/`). The product rename to
  Project Worlds does **not** rename the character; whether she keeps
  her established name or takes a new one is the owner's call, not to be
  inferred by an agent. This is the one open identity question; it
  blocks nothing else (runtime strings above reference it only as a
  ordering dependency).
- Whether/when the repository slug, Python package, and CLI command
  should follow the product rename — explicitly deferred, not decided
  (same for runtime UI strings; see identity-pass section).
- Live production/deployment state of this trunk outside this checkout
  — not verified this pass (local + CI evidence only).
