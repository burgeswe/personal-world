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
- **Design truth:** `design/tokens.json` and
  `docs/DESIGN-HANDOFF.md` are canonical. `design/handoff/` is an
  archived spec package — historical, never edit it to change design.
  `design/COMPANION_INTEGRATION.md` is the current companion/chat
  architecture.
- **Do not casually regenerate:** the Mermaid master
  (`design/assets/mermaid-companion-master.lottie` — byte-identical
  by decision), all companion source rigs, the icon library, and the
  screen SVGs. They are deliberate artwork, not generated output.
- **Specs are not implementations.** Theme packs, the Chat surface,
  and preference-driven customization are designed (see
  `ROADMAP.md`) but not implemented. Do not wire them as if they
  exist; the design handoff's future-requirements section says the
  same.
- **Security boundary:** no private endpoints, credentials, personal
  data or deployment topology in any tracked file.
  `tests/test_public_safety.py` is the regression gate; read
  `SECURITY.md` for the full contract.
- **Validation command:** `uv run pytest --timeout=30` and
  `uv run personal-world framework validate --json` from the repo
  root. CI runs the same.
- **Where future plans live:** `ROADMAP.md` (direction, not
  promises). Do not treat roadmap items as commitments or
  authorization.
