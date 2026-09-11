# Agent state — 2026-09-10 (Phase 0 complete)

Authoritative plan: `docs/PERSONAL-WORLD-COMPLETION-PLAN.md`. This file
records only where we are in that plan and the exact next action.

## Current phase

**P0 — Stabilize: COMPLETE** (merged via main `b8c77ce`). **P1 — Frontend
foundation: T0–T9 COMPLETE.** T1–T4 merged to main via PR #20 (main =
`1fda243`); T5–T9 accumulated on `p1/frontend-foundation` (pushed,
remote == local). No Fable review consumed: owner policy (2026-09-11)
supersedes the spec's FABLE-review rows — GLM-autonomous against the spec;
Fable reserved for genuine contradictions and the final convergence audit.
Construction continues on `../pw-p1` (`p1/frontend-foundation`) → T10.
Six pre-existing CodeQL alerts (identity/vault/legacy api.py) are recorded
security debt: identity/auth → P2, vault → P3, legacy api.py → T15.

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

## P1 progress (2026-09-12, overnight autonomous run)

| Task | Commit | Status |
|---|---|---|
| T1 sections API | `b65c57c` | merged (PR #20) |
| T2 motion vocab | `d5c31e5` | merged (PR #20) |
| T3 serving/Docker + CodeQL fix | `2608a7a` + `6fe49cc` | merged (PR #20) |
| T4 frontend tracked + dep diet | `5b288e5` | merged (PR #20) |
| T5 token pipeline | `86fe750` | pushed, branch |
| T6 typed API boundary | `533c35b` | pushed, branch |
| T7 primitives A (Dialog/Popover/LiveRegion) | `216ffb7` | pushed, branch |
| T8 primitives B (Drawer/Disclosure/StatusChip/CompanionSlot/StepUpPrompt) | `74bb73c` | pushed, branch |
| T9 AppShell/SectionNav/EmptyState/ErrorState/prefs bootstrap | `1654193` | pushed, branch |

Last full verification (T9): Python 494 passed · `framework validate`
healthy · frontend 147 tests green · build 100.3 KB gz ≪ 350 KB ·
tokens/hex/motion gates green. Known honest UNKNOWNs: jsdom cannot prove
paint order (prefs-before-content enforced structurally) or real-viewport
cascade — both are Playwright/browser-gate evidence (T14).

## NEXT

1. **T10–T13** may run as parallel worktrees off `1654193` (spec §9).
2. **T14** browser/Playwright gates after T10–T13.
3. Merge checkpoint (PR) at T9+ if owner prefers earlier convergence;
   otherwise next convergence target is after T14 gates.
4. Fable: only for genuine contradiction, or the final convergence audit.
5. C1 (Authelia OIDC coordination) prep — P2 scope, unchanged.
