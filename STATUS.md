# Personal World — current-state entry point

This file answers one question: **where do I look to know what is
happening right now?**

## The canonical cross-repository current state

Live epoch state (what is in progress, what is blocked, what just
landed across the homelab-family repos) is tracked in the **homelab
repository's agent checkoff**:

```text
burgeswe/homelab  →  docs/agent/CHECKOFF.md      (current epoch rows)
burgeswe/homelab  →  docs/agent/handoffs/LATEST.md   (detailed deltas)
```

Personal World work appears there as rows tagged with this repo. This
repository intentionally does **not** maintain a second, hand-updated
copy of that state — one fact should be maintained once.

## What is true inside this repo (no external repo needed)

| Question | Answer here |
|---|---|
| What does this product do today? | `README.md` ("What works today") |
| What is designed but not implemented? | `ROADMAP.md` (direction, not promises) |
| What changed, when? | `CHANGELOG.md` (Keep-a-Changelog) |
| What governs UI work? | `docs/accessibility/ACCESSIBILITY_CONTRACT.md` (non-negotiable) |
| How is it structured? | `docs/ARCHITECTURE.md`, `docs/NATIVE-BASELINE-AND-ENRICHMENT.md` |
| How do I run it? | `docs/OPERATIONS.md` |
| How do I validate my work? | `uv run pytest --timeout=30`, `uv run personal-world framework validate --json` |
| Security contract? | `SECURITY.md` |

## Staleness rule

This file is a pointer, not a source. If the rows above ever disagree
with the homelab CHECKOFF, the CHECKOFF (plus live runtime evidence)
wins — repository and runtime evidence outrank any handoff, including
this one.