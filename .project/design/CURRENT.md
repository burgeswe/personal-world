# Personal World — Design Context: CURRENT

Answers current design questions from repository evidence, verified
2026-09-12 by the integration session. **This file routes; canonical files
govern.** When this file and a canonical file disagree, the canonical file
wins. `UNKNOWN` is an honest answer, not a gap to fill.

Evidence basis: git history at `8963dda`, README "What works today",
CHANGELOG (Unreleased + 2026-09-07..09), docs/DESIGN-HANDOFF.md
(V0.1 baseline note), docs/accessibility/* (canonical),
design/handoff/FRAME_INDEX.md (archived), design/tokens.json,
frontend/ sources, live `npm run tokens:check` (passing).

## CURRENT DESIGN AUTHORITY

- **Canonical design truth:** `design/tokens.json` (repo-owned, semantic,
  implementation-neutral) + `docs/accessibility/` (the floor).
- **Design-stage visual source:** Figma file `VATVojyJZT9HKx0CrDS0yr` for
  explicitly approved frames (see APPROVED FRAMES below — approval means
  the archived V0.1 handoff status **plus** not being superseded by later
  repo work).
- **`docs/DESIGN-HANDOFF.md`** is the canonical *V0.1 baseline* reference;
  its dated inventories are historical (per its own 2026-09-10
  reconciliation note). The Finish Line document describes the target
  horizon, not the current design.
- **Composition lessons:** `docs/FIGMA-HANDOFF-LESSONS.md` (2026-09-11) —
  token gates do not check composition; browser-side visual comparison
  against Figma exports is required before composition work merges.

## IMPLEMENTATION FRAMEWORK

- **React 19 + Vite + TypeScript** SPA tracked as `frontend/`
  (react-router-dom v7, Tailwind v4 `@theme` aliases, shadcn-derived
  primitives in `frontend/src/components/ui/`, oxlint, Vitest + vitest-axe,
  Playwright).
- Served by the Python backend in react mode via `PW_FRONTEND=react`
  (default stays `legacy` server-rendered mode until parity).
- Generated token layer: `frontend/src/tokens.css` from
  `design/tokens.json` (`npm run tokens:check` drift gate — passing at
  8963dda). Self-hosted fonts/icons; no external font/icon requests.
- `frontend-v2/` (untracked) is an experiment; not implementation truth.
- The backend (`src/personal_world/api.py`) remains the legacy UI baseline.

## CANONICAL VIEWPORTS / BREAKPOINTS

From `docs/accessibility/RESPONSIVE_RULES.md` (canonical):

| Effective CSS viewport | Behavior |
|---|---|
| ≥900px | fixed left icon rail (`--rail-width: 72px`); no separate 1200px breakpoint |
| 600–899px | top banner with horizontal links; stacked shell |
| ≤599px | fixed bottom navigation (60px + safe-area inset) |

Figma's designed 1440/900 frames map onto this implemented cascade; the
implemented breakpoints govern.

## APPROVED FRAMES (design-stage authority)

From the archived frame index (`design/handoff/FRAME_INDEX.md`) — V0.1
handoff status; treated as design-stage approval, not implementation status:

- Handoff row: `16:157` (index), `16:5` (accessibility contract visual).
- Core screens: `4:5` Today Hybrid Desktop 1440, `6:4` World Capability
  First, `3:445` Journal, `5:4` Settings Refined.
- Responsive: `14:472` cascade, `4:135` narrow 900.
- Today states: `3:722` empty, `3:779` attention, `3:941` partial,
  `3:1044` loading.
- Rules/patterns: `14:5` responsive rules, `14:914` + `4:266` accessibility
  stress, `5:283`/`5:449`/`5:587` patterns, `7:4`/`7:192` feature details.
- Companion/themes: `11:4`, `13:4`, `13:295` (World Keeper construction —
  note: World Keeper predates the current five-resident companion set, see
  COMPANION STATUS), `3:2005` comfortable theme, `3:2147` high contrast.

**Chat frames — approved?** Chat screen SVGs (active conversation, empty,
error, thinking, tool capability, source provenance, long dense, contextual
VEFR, narrow responsive) were exported from Figma 2026-09-06 and are
repo-tracked, but **no approval status is recorded anywhere in current
evidence** — the archived frame index predates them. Approval: **UNKNOWN**
(owner decision pending or unrecorded).

**Capability detail frame `197:902` — approved?** **UNKNOWN.** No frame
`197:902` exists in tracked evidence (frame index, SVG exports, docs). The
closest authoritative detail frames are `7:4` and `7:192` (Feature Detail
1/2). If `197:902` exists in the live Figma file, it is not represented in
repo evidence and carries no recorded approval.

## EXPERIMENTAL / REFERENCE / SUPERSEDED

- Reference (not implementation targets): `3:1268` Design Direction,
  `6:230` Reference Studies.
- Superseded (do not implement): `3:1438`, `7:565`, `9:5`, `14:1147`,
  `7:371` (archived "Row 10").
- Theme exploration frames (generic vs. rylee-theme boards) are reference
  material for the theme-pack system, not screen approvals.
- **How to identify current vs. superseded:** (1) archived index status;
  (2) whether later repo work replaced it (CHANGELOG/design commits);
  (3) `.project/design/CURRENT.md` — this file; (4) ask the owner when
  still ambiguous. Superseded means historical; it never means "delete
  provenance".

## IMPLEMENTED SCREENS (runtime truth)

Routes in the React frontend (`frontend/src/App.tsx` at 8963dda):
`/` Today, `/interests`, `/media`, `/projects`, `/lab`, `/chat`, `/journal`,
`/vault`, `/world`, `/settings`, plus `/login` and `/setup` (auth routes).
README "What works today" confirms implemented pages: **Today, Chat, World,
Journal, Vault, Settings** (real data loading, explicit partial/error
states), plus the P1 composition passes (real headings, no card chrome on
Today/Journal/Vault). Legacy server UI coexists (`PW_FRONTEND` selects).

## SEMANTIC TOKEN MAPPING

- Canonical source: `design/tokens.json` (~32 leaf values):
  `color` (14: aubergine dark surfaces + light theme + accents
  `#72b1b1` teal / `#b57f8b` dusty rose), `status_vocabulary`
  (8 words, luminance-only rank encoding), `spacing` (4), `targets` (2),
  `motion` (1: off/reduced/subtle), `focus` (2), `typography` (6).
- Derived: `frontend/src/tokens.css` (generated; drift-gated, passing).
- **Figma-side variables: only four exist** (Figma's own report) — the
  Figma token representation is immature and NOT a meaningful canonical
  tokens source. Repo tokens govern; Figma derives.

## COMPANION STATUS

- **Canonical companion set:** five residents (Mermaid, Little Helper
  Robot, World-tree Squirrel, Tacos & the Morning Paper, Personal World) —
  `design/COMPANION_INTEGRATION.md` (2026-09-07) supersedes the earlier
  Mermaid-centric pass and the older **World Keeper** globe concept.
- World Keeper frames in the archived index are **historical** — kept as
  provenance, not current companion authority.
- Runtime: companion selection + standalone Chat page exist; contextual
  identities/tool workflows from the exported chat screens are target
  work (Finish Line), not implemented.
- Deliberate artwork — do not casually regenerate: Mermaid master Lottie
  (byte-identical by decision), companion source rigs, icon library,
  screen SVGs.

## ACCESSIBILITY PRECEDENCE

`docs/accessibility/ACCESSIBILITY_CONTRACT.md` is non-negotiable and
ouanks literal visual matching everywhere (contract agreement, recorded):
44px targets, luminance-only rank encoding, motion reduced by default,
keyboard-complete, real headings/landmarks, 200% reflow, and OS
`prefers-reduced-motion` unconditionally overriding app preferences.
When an approved frame and the floor conflict, the floor wins and the
conflict is recorded back to design.

## LOCAL EXPORTS AVAILABLE

See the export classification in
`.project/participants/figma/contract-return/project-context.md` — every
recommended export is classified AVAILABLE / NEEDS_FIGMA_EXPORT /
NOT_YET_MEANINGFUL / UNKNOWN against what actually exists on disk.