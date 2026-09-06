# AGENTS.md

Shared-working-tree rules for every agent and human working in this
repo. Nothing else here yet; keep it that way unless a rule earns its
place.

## Shared checkouts and worktrees

Parallel epochs run concurrent agents against this repository. A
shared checkout is a hazard: one agent's `git add -A` sweeps another
agent's WIP into its commit. The rules:

- **Workers use separate worktrees.** One checkout per lane:
  `git worktree add ../pw-<lane> <branch>`. Never run two lanes in
  the same directory.
- **Never `git add -A`** in a shared checkout. It stages whatever
  else is in flight — including another agent's half-finished edits.
- **Stage explicit paths only**: `git add src/... tests/...`, or use
  `scripts/safe-commit.sh -m "message" <path> ...` which stages named
  paths, refuses when >5 unrelated files are modified outside them
  (override: `--force`), and runs pytest before committing.