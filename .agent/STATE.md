# Agent state — 2026-09-10 (completion plan adopted)

Authoritative plan: `docs/PERSONAL-WORLD-COMPLETION-PLAN.md`. This file
records only where we are in that plan and the exact next action.

## Current phase

**P0 — Stabilize the working tree and secret boundary.** Not started.
Implementation has NOT begun; the plan commit is documentation only.

## Verified starting state (read-only inspection, 2026-09-10)

- `main` fast-forwarded to `f6658dd` (documentation-only commits), then
  the completion plan added on top.
- Uncommitted, deliberately untouched, working-tree changes in the
  development checkout: modified `config/connections.json` (tracked;
  contains inline provider keys — hazard H1), modified
  `src/personal_world/api.py` (+188 lines: plaintext connections routes,
  absolute home paths, React `dist` serving — hazard H3), untracked
  `config/principal.json` and `frontend-v2/` (hazards H2, H4).
- Working-tree suite: 368 passed / 11 failed. Attribution: 7 from React
  `dist` taking over `/`; 2 from tracked inline secrets; 2 environmental
  (host `init.defaultBranch` is not `master`/`main`).
- `framework validate`: unhealthy, 3 violations (working-tree `type: cloud`
  connections lacking `capability`). Clean HEAD is expected healthy.
- Latent HEAD bugs queued for P0: `/login` empty body (H5), scheduler
  `append_raw` crash (H6), unauthenticated `/api/chat/test`, 500 on
  cemented policy, mutating `GET /api/daily` (H7), step-up bypass via
  private address or header (H8).
- Exposed credential values are considered burned and are being rotated
  by the owner (P0.1). Agents must not receive, record, or reuse them.

## Decisions in force

D1 React 19 + Vite frontend (tokens remain design truth) · D2 Authelia OIDC
first proof behind a provider-neutral seam, cookie sessions + bearer,
real step-up, hardened break-glass · D3 opt-in `subtle` motion · D4 NDJSON
journal + Markdown memory + disposable FTS · D5 homelab `scripts/lab` is the
Lab provider via `PW_LAB_CLI`; calendar provider undecided · D6 Sonarr /
Radarr / Lidarr / Plex; RSS + candy-dispenser Interests baseline.
Corrections C-1..C-5 (private runtime config ownership, provider contracts
over mount names, disposable session/index state, transitional standalone
Chat, lean tooling) are folded into the plan.

## Open decision

Calendar provider for the first real implementation. Nothing blocks on it.

## NEXT

1. Owner: P0.1 credential rotation (outside agent visibility).
2. Then dispatch P0.2–P0.7 as bounded tasks in a dedicated worktree
   (`git worktree add ../pw-p0 -b p0/stabilize`), one commit each,
   verified by `uv run pytest --timeout=30` and
   `uv run personal-world framework validate --json`.
3. Open coordination item C1 in `burgeswe/homelab` so it is ready for P2.

Do not begin P1 until P0's exit criterion (HEAD green locally and in CI,
validator healthy, no secret material tracked or unignored) is met.
