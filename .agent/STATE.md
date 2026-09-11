# Agent state — 2026-09-10 (Phase 0 complete)

Authoritative plan: `docs/PERSONAL-WORLD-COMPLETION-PLAN.md`. This file
records only where we are in that plan and the exact next action.

## Current phase

**P0 — Stabilize: COMPLETE** (branch `p0/stabilize`, fast-forwarded to
`main`). **P1 — Frontend foundation: spec approved
(`docs/p1/FOUNDATION-SPEC.md`), implementation NOT started.** Gate: owner
confirmation of P0.1 credential rotation → push `main` → CI green for that
exact SHA → coordination item C1 prepared → worktree `../pw-p1`
(`p1/frontend-foundation`) → T1.

## P0 outcome (verified)

| Task | Status | Evidence |
|---|---|---|
| P0.1 credential rotation | OWNER — outside agent visibility | old values treated as burned; no client-side replacement token exists |
| P0.2 private-config/gitignore | done | `.gitignore`, `config/README.local.md` ownership rule |
| P0.3 unsafe experiment discarded; safe display-name route | done | `tests/test_principal_profile.py` (5) |
| P0.4 scheduler crash | done | `tests/test_scheduler.py` (4) |
| P0.5 API/auth correctness | done | `tests/test_api_correctness_p0.py` (12) |
| P0.6 deterministic git fixtures | done | `tests/test_source_control.py` green with host `init.defaultBranch=dev` |
| P0.7 secret-shape scanner, redacted | done | `tests/test_public_safety.py` (23; planted-key negative proof run manually) |
| P0.8 state reconciled | done | this file, `CHANGELOG.md` |
| P0.9 safe-commit.sh | done | `tests/test_safe_commit.py` (7); exec bit set |

Suite: **425 passed** on this host (previously 368/11 on the dirty tree,
2 environmental failures on clean HEAD). `framework validate`: healthy.

Development checkout cleanup performed with P0: tracked
`config/connections.json` restored to zero-provider; the untracked
`config/principal.json` removed (display name now lives in
`data/users.json` via the API); `frontend-v2/.env` and `frontend-v2/dist/`
(both carried the burned client token) deleted; `frontend-v2/src` no
longer references any `VITE_*` token. `frontend-v2/` source itself stays
untracked until P1 renames it to `frontend/` and commits it.

## Known, intentionally deferred to later phases

- `require_step_up` still accepts the `X-PW-StepUp: 1` header / private
  addresses — **P2** replaces it with session-level step-up. P0 only made
  the *routes* declare the write-path dependency.
- Native Vault base64 fallback when `cryptography` is absent — **P3**.
- `compose.yaml` host-specific bind mounts and missing `TZ` — **P14**.
- Legacy `DASHBOARD_HTML` / three setup flows — retired in **P1** after
  browser-verified parity.

## Decisions in force

D1 React 19 + Vite frontend (tokens remain design truth) · D2 Authelia OIDC
first proof behind a provider-neutral seam, cookie sessions + bearer,
real step-up, hardened break-glass · D3 motion `off | reduced (default) |
subtle`, OS reduced-motion always wins · D4 NDJSON
journal + Markdown memory + disposable FTS · D5 homelab `scripts/lab` is the
Lab provider via `PW_LAB_CLI`; calendar provider undecided · D6 Sonarr /
Radarr / Lidarr / Plex; RSS + candy-dispenser Interests baseline.
Corrections C-1..C-5 folded into the plan. **No client-side bearer token,
ever** (anything in Vite env is inlined into the public bundle).

## Open decision

Calendar provider for the first real implementation. Nothing blocks on it.

## P1 spec decisions in force (2026-09-10)

Only `settings` is pinned; `today` hideable; "Restore default sections"
in Settings · no invented status values (`status.py` vocabulary or
`null`); `configured` is separate from `status`; provider failure never
removes a section · CompanionSlot: artwork `aria-hidden` and the "Open
World assistant" button are siblings, never nested · lean deps: typed
fetch + hooks, no React Query/Storybook without a bounded justification ·
200% zoom: automated checks are proxies, a real browser zoom check on the
deployed build is a required human gate.

## NEXT

1. Owner: confirm P0.1 rotation done (new values only in `.env` /
   `config/connections.local.json` via env indirection). **Assume not
   done until explicitly confirmed.**
2. Push `main` exactly as-is; verify remote `main` SHA; verify CI green
   for that exact SHA. No feature work if CI is not green.
3. Prepare coordination item C1 in `burgeswe/homelab` (Personal World
   performs app-level Authelia OIDC; route must not depend exclusively on
   forward-auth; break-glass reachable during IdP outage; register the
   OIDC client). Preparation only — P2 is not implemented.
4. Begin **P1** in `../pw-p1` on `p1/frontend-foundation`, starting at
   T1 (T0 is the spec, already committed). Order and acceptance per
   `docs/p1/FOUNDATION-SPEC.md` §9–§11.
