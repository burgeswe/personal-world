# Current State

Verified 2026-09-12 by the integration session (evidence: git state, README
"What works today", CHANGELOG Unreleased, docs). This file routes — canonical
truth lives in the files it names. When this file and a canonical file
disagree, the canonical file wins.

- **Product status:** 0.1, active development. Public repo; private runtime
  config/personal data live outside tracked files (see `SECURITY.md`).
- **What works today:** see README.md "What works today" (canonical).
- **Current epoch:** P1 frontend foundation (T1–T9 landed; T14 composition
  passes merged to `uat/t14-warmth` — Today/Journal/Vault card-chrome removal,
  real headings). Check `CHANGELOG.md` Unreleased and the homelab checkoff
  for the live epoch state.
- **Design truth:** `design/tokens.json` (canonical tokens; repo-owned),
  `docs/DESIGN-HANDOFF.md` (V0.1 baseline reference, partly superseded),
  `docs/accessibility/` (non-negotiable floor). `design/handoff/` is an
  archived Figma spec package — historical, never edit to change design.
- **Figma participant pack:** `.project/participants/figma/` — status:
  **accepted** (contract gate PASS; commitment ACTIVE), promoted 2026-09-12
  after a re-pass (her first-pass writes didn't persist — see
  `figma/contract-return/RE-PASS.md`). This line was stale (still said
  proposed/pending) as of the promotion; corrected during a later
  UI-convergence session cross-check, which also fixed a structural YAML
  bug in `figma/references.yaml` (missing `provenance:` keys on 44/47
  frame entries — the file did not parse before the fix).
- **In-flight work not to disturb:** active UI implementation lanes
  (task/today-composition, task/journal-vault-composition, task/settings-fixes,
  task/heading-a11y worktrees; uat/t14-warmth integration branch;
  frontend/vite.config.ts has a local modification; frontend-v2/ and
  .bcode/ are untracked experiments).

UNKNOWN (as of this pass): which UI lanes have merged to `main` vs
`uat/t14-warmth`; treat branch state as the authority, not this file.