# Project Worlds — current-state entry point

**Retired as an independent authority 2026-09-12.** This file answered
"where do I look to know what is happening right now?" by pointing at
two competing places (this table, plus the external homelab CHECKOFF)
that drifted out of sync with each other and with `.agent/STATE.md`.
Per the Play-Nice `project-context-and-participant-packs` /
`stable-truth-replaceable-machinery` contracts: **one canonical current
truth; other documents may point to it.**

## Canonical current-state pointer

**`.project/CURRENT.md`** answers "what is true right now" — repo
state, branch, Play-Nice adoption, Figma pack status, and what's next.
Read that file first.

The external `homelab` repository's `docs/agent/CHECKOFF.md` may still
track cross-repo epoch rows, but it is not treated as authoritative for
this repo's current state anymore — it was found stale (still
referencing a 2026-09-09 milestone, predating the entire P1 frontend
build) during the 2026-09-12 trunk-unification pass, and this repo does
not maintain a second hand-updated copy to keep it honest.

## Where things live (durable, not "current state" — these don't drift the same way)

| Question | Answer here |
|---|---|
| What does this product do today? | `README.md` ("What works today") |
| What does "finished enough to live in every day" mean? | `docs/PERSONAL-WORLD-FINISH-LINE.md` (filename kept; content still applies — see `.project/CURRENT.md` for the identity-pass note) |
| How do we get there, in what order? | `docs/PERSONAL-WORLD-COMPLETION-PLAN.md` (historical plan document — phase-tracker role now superseded by `.project/CURRENT.md`, see `.agent/STATE.md`) |
| What is designed but not implemented? | `ROADMAP.md` (direction, not promises) |
| What changed, when? | `CHANGELOG.md` (Keep-a-Changelog) |
| What governs UI work? | `docs/accessibility/ACCESSIBILITY_CONTRACT.md` (non-negotiable) |
| How is it structured? | `docs/ARCHITECTURE.md`, `docs/NATIVE-BASELINE-AND-ENRICHMENT.md` |
| How do I run it? | `docs/OPERATIONS.md` |
| First run on new hardware | `docs/OPERATIONS-FIRST-RUN.md` (daily-use runbook, 2026-09-09) |
| How do I validate my work? | `uv run pytest --timeout=30`, `uv run personal-world framework validate --json` |
| Security contract? | `SECURITY.md` |