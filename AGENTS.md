## Mandatory agent preflight

Before doing substantive work, read [`AGENT_POLICY.md`](./AGENT_POLICY.md) and follow the canonical contract/index system it references.

**Repository truth outranks inference. Unknown is a valid state. Make honesty cheaper than fabrication.**

# AGENTS.md

Shared-working-tree rules for every agent and human working in this
repo. Nothing else here yet; keep it that way unless a rule earns its
place.

## Shared checkouts and worktrees

Parallel epochs run concurrent agents against this repository. A
shared checkout is a hazard: one agent's `git add -A` sweeps another
agent's WIP into its commit. The rules:

- **Workers use separate worktrees.** One checkout per lane:
  `git worktree add ../pw-<lane> <branch>`. Never run two lanes in the
  same directory.
- **Never `git add -A`** in a shared checkout. It stages whatever
  else is in flight — including another agent's half-finished edits.
- **Stage explicit paths only**: `git add src/... tests/...`, or use
  `scripts/safe-commit.sh -m "message" <path> ...` which stages named
  paths, refuses when >5 unrelated files are modified outside them
  (override: `--force`), and runs pytest before committing.

## Where truth lives (read before trusting)

- **Current architecture:** `docs/ARCHITECTURE.md`. World model and
  invariants: `docs/NATIVE-BASELINE-AND-ENRICHMENT.md` (normative,
  enforced by `personal-world framework validate`).
- **Current product finish line:** `docs/PERSONAL-WORLD-FINISH-LINE.md`.
  Use it to determine what “finished enough to live in every day” means;
  it outranks speculative roadmap items but does not override architecture,
  security, accessibility, or human-reliability contracts.
- **Design truth:** `design/tokens.json` and
  `docs/DESIGN-HANDOFF.md` are canonical for the V0.1/current-baseline
  design. `docs/PERSONAL-WORLD-FINISH-LINE.md` defines the target
  completion experience. `design/handoff/` is an archived spec package —
  historical, never edit it to change design.
  `design/COMPANION_INTEGRATION.md` is the current companion/chat
  architecture.
- **Accessibility is non-negotiable and canonical at
  `docs/accessibility/ACCESSIBILITY_CONTRACT.md`.** Any UI change —
  screens, components, CSS, tokens — answers that contract first
  (44px targets, luminance-only rank encoding, motion reduced by
  default, dark-mode default; OS `prefers-reduced-motion` overrides
  application motion preferences). The screen-reader walkthrough,
  responsive rules, and the preference schema floor live alongside
  it in `docs/accessibility/`. Do not edit files under
  `design/handoff/` to change accessibility truth; the canonical
  copies are in `docs/accessibility/`.
- **Do not casually regenerate:** the Mermaid master
  (`design/assets/mermaid-companion-master.lottie` — byte-identical
  by decision), all companion source rigs, the icon library, and the
  screen SVGs. They are deliberate artwork, not generated output.
- **Specs are not implementations.** Check `README.md`, `ROADMAP.md`,
  the current code, and live behavior before deciding whether a designed
  feature exists. Chat and preference-driven customization already have
  implemented portions; do not regress them or assume the Finish Line's
  richer target behavior is already complete.
- **Security boundary:** no private endpoints, credentials, personal
  data or deployment topology in any tracked file.
  `tests/test_public_safety.py` is the regression gate; read
  `SECURITY.md` for the full contract.
- **Validation command:** `uv run pytest --timeout=30` and
  `uv run personal-world framework validate --json` from the repo
  root. CI runs the same.
- **Where future plans live:** `ROADMAP.md` (direction, not
  promises). Do not treat roadmap items as commitments or
  authorization. The Finish Line defines the desired completion target;
  current implementation evidence determines what remains to be built.
