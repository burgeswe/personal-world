# Documentation reconciliation — 2026-09-10

Scope: documentation only on main, based on implementation commit
5017865a900dd3787bc83a5d4a048cc4e4050395. No implementation, tests, assets,
configuration, or archived design/handoff files changed.

## Current findings

- Navigation includes Vault. CSS has a top banner at 600–899px and a later
  bottom-navigation override below 600px. The older review missed that override.
- Motion default is reduced; OS reduced-motion overrides. Canonical provider
  vocabulary comes from status.py, not the stale unhealthy label.
- Architecture/README now inventory implemented Chat, preferences, services,
  setup, identity, Vault, reminders, theme manifests, forge/ingress/Lab reads.
- Current standalone Chat is read-only. Finish Line governs contextual/global
  chat and stronger authentication; current foundations do not prove completion.
- Roadmap and dated design/runbook scope notes route current claims to current
  source-backed references. Archived design artifacts remain untouched.

## Verification

- Baseline full suite in WSL: 379 passed, 230 deprecation warnings, 54.67s.
- Framework validator: healthy, zero violations.
- docker compose config -q: exit 0 (configuration only, no deployment).
- Edited-tree full suite: 379 passed, 230 deprecation warnings, 51.40s.
- Final docs/public-safety check after follow-up annotations: 58 passed, 2.73s.
- git diff --check: passed; protected implementation/archive paths have no diff.
- Exact-commit GitHub CI evidence is reported with the documentation commit.
- Windows default uv sync initially failed on a Linux-style .venv entry;
  use WSL for this checkout. A separate Windows environment was also installed
  outside the repository; it was not used for the accepted test run.

## Remaining gaps and exact continuation

Documentation records native Vault's no-crypto fallback and misleading encrypted
status, broad private-peer/header step-up checks, public chat probe, partial
instance/per-user isolation, nonuniform private-config loading, and incomplete
full-instance backup. The design preference schema permits more motion choices
than prefs.py; Accessibility contract's illustrative status list omits warning.
These are not newly implemented fixes or full security/accessibility acceptance.

NEXT: verify the documentation commit's GitHub validate/CodeQL checks. Any code
follow-up needs a separately scoped task: first inspect vault.py's fallback and
api.py's encrypted status and require_step_up before defining a safe fix.
Manual screen-reader/device behavior and deployed SSO/Vault-provider/recovery
acceptance remain UNKNOWN. No deployed application was changed.
