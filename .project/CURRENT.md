# Current State

Verified 2026-09-12 by bcode/claude at the close of the T14 UI-convergence
pass (evidence: `git status`/`git log`/`git rev-parse` on the actual
branch, not memory). This file routes — canonical truth lives in the
files it names. When this file and a canonical file disagree, the
canonical file wins.

- **Product status:** 0.1, active development. Public repo; private runtime
  config/personal data live outside tracked files (see `SECURITY.md`).
- **What works today:** see README.md "What works today" (canonical).
- **T14 UI-convergence pass: CLOSED, frozen completion point.**
  Branch `uat/t14-warmth`, HEAD `5a0ff7119f1108d56eb79f9de13926955fe9d25c`
  — confirmed clean working tree, local == remote, zero divergence, at
  close. `main` and PR #22 (`p1/integration`) were never touched by this
  pass. Do not reopen this composition/accessibility work; it is
  accepted. All four task worktrees (today-composition,
  journal-vault-composition, settings-fixes, heading-a11y) merged into
  this branch and can be removed. Contents of the pass, in commit order
  from `8963dda`: Today/Journal/Vault card-chrome removal + real
  headings; Settings companion-key + live-refresh fixes; two
  independently-discovered accessibility bugs (invisible keyboard focus
  ring — `design/tokens.json` had unresolved-token/invalid-shorthand
  CSS; OS `prefers-reduced-motion` silently overridden by a saved
  "subtle" preference in the React port) fixed and test-covered; a
  Figma-handoff composition-drift postmortem
  (`docs/FIGMA-HANDOFF-LESSONS.md`); the Play-Nice project-context +
  Figma participant pack imported and integrity-checked; the adoption
  pin bumped to v0.5.0. Full verification evidence (291/291 frontend
  tests, 510/510 backend tests, clean build/lint, live CDP-driven
  browser confirmation of both a11y fixes) lives in the session
  transcript this file cannot reproduce — treat the commit messages on
  `uat/t14-warmth` (`aa14625`..`5a0ff71`) as the durable record.
- **Design truth:** `design/tokens.json` (canonical tokens; repo-owned),
  `docs/DESIGN-HANDOFF.md` (V0.1 baseline reference, partly superseded),
  `docs/accessibility/` (non-negotiable floor). `design/handoff/` is an
  archived Figma spec package — historical, never edit to change design.
- **Play-Nice adoption:** pinned to v0.5.0 @
  `805f58b46fb59adefd1dee85dd99178d9dbaa1d9` (`.project/contracts/adoption.yaml`)
  — bumped from v0.3.0 during this pass; gate PASS, commitment ACTIVE
  for the `contract-refresh-and-push` task (session artifact under the
  gitignored `.contracts/`).
- **Figma participant pack:** `.project/participants/figma/` — status:
  **accepted** (contract gate PASS; commitment ACTIVE) for her original
  bundle at revision `0c0ab7c5` (v0.3.0). Not yet re-attested against
  the current v0.5.0 pin — see
  `figma/contract-return/NEXT-REVISION-NOTE.md` for the exact, small,
  non-blocking gap (2 new + 2 changed contracts need her own
  task-impact sentences, not fabricated ones).
- **Next focus is a different project ("Project Worlds") — see that
  project's own `.project/CURRENT.md` once established.** This repo is
  not superseded; it simply is not the active focus of the next
  session. Nothing here should be carried into Project Worlds by
  default — only what that project explicitly adopts.
- **Untracked, not part of any pass:** `frontend-v2/` and `.bcode/` are
  pre-existing local experiments, unrelated to T14, untouched by it.

UNKNOWN: none outstanding for this pass — branch state, gate, and
commitment are all confirmed above, not inferred.