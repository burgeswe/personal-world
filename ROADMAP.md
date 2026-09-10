# Roadmap

Direction, not promises. Personal World is developed by one human with
an AI-agent workflow; items move between horizons freely and nothing
here is a delivery commitment. Dates exist only where a milestone has
already happened.

Grounding: every item below is recovered from the design handoff's
engineering-requirements section, implemented-but-incomplete seams in
the code, or explicit spec documents — not invention.

For the current completion target, `docs/PERSONAL-WORLD-FINISH-LINE.md`
is authoritative. This roadmap organizes direction; it does not redefine
what "finished enough to live in every day" means.

## Now

Work that completes or hardens what 0.1 already promises or is required
by the current finish line:

- **Secret vault.** DONE (2026-09-09): Fernet-encrypted file vault
  (`/data/vault.enc`, PBKDF2-600k) behind real unlock/lock/set/
  delete/names endpoints; the image now installs `cryptography` so
  container path includes encryption. Minimal installs without the crypto extra
  still fall back to base64; native HTTP backend selection and stronger
  re-authentication remain incomplete. See `docs/ARCHITECTURE.md` for the current
  boundary. The UI lists names rather than redisplaying stored values.

- **Accessibility-preference → dashboard wiring.** DONE (2026-09-07):
  preferences render server-side and apply live in the dashboard
  (text scale, density, targets, companion, accent); the floor stays
  test-enforced. Remaining polish: more granular reading preferences.
- **Chat surface.** DONE (2026-09-07, extended 2026-09-09): Chat is a
  first-class surface with a provider-neutral adapter (`ollama` or
  `openai_compat` connections), a trimmed read-only world-context
  injection, honest not_configured/unavailable states, and
  conversation history. Verified end-to-end in-container against the
  Xiaomi MiMo cloud endpoint (2026-09-09); provider keys reach the
  core by env indirection. Remaining: streaming responses, richer
  per-surface context.
- **Provider-neutral SSO / stronger authentication.** REQUIRED by the
  current finish line, not yet complete. Preserve the existing
  fail-closed bearer-token boundary while adding a provider-neutral
  identity/SSO path that can integrate with existing systems, supports
  step-up authentication for severe/destructive actions and sensitive
  vault/secure-note access, and retains recoverable bootstrap/break-glass
  access. The architecture must not depend on Authelia specifically and
  should remain suitable for future non-browser clients.
- **Theme Pack implementation.** Partially done (2026-09-07):
  companion selection and accent palettes are wired through the
  preference system with approved art served from the package. Still
  implemented: `ThemePackRegistry` loads manifest files and serves theme APIs.
  Still open: full frontend application of pack assets/state poses and per-pack
  icon families from `design/THEME_PACK_FRAMEWORK.md`'s manifest format.

## Next

Relevant remaining work and partially implemented seams:

- **Source-control enrichment.** Native Git feeds dashboard/chat context;
  `providers/gitea_enrichment.py` and `/api/source-control/rollups` now exist.
  Broader project/repository mission control remains finish-line work.
- **Ingress rollups.** `providers/traefik_ingress.py` and
  `/api/ingress/rollups` now exist. Verify configured-provider behavior in the
  deployment; implementation alone is not operational acceptance.
- **"Last observed" age display** for stale surfacing.
- Quick actions — DONE 2026-09-09: "Add a note" composer (POST /api/journal) + step-up writes; more verbs can follow.
- Apps/Services launcher — DONE 2026-09-09: GET/PUT /api/apps registry (data/apps.json, step-up gated, journal-audited) + dashboard Services card.

## Exploring

Preserved ideas, no commitment:

- Open design questions from the Figma stage (navigation style,
  density, mascot microcopy, personal-mode presentation) — see the
  design handoff's open-questions section.
- Further mobile refinement; the current CSS already has phone bottom navigation
  and larger-target adaptations (see canonical responsive rules).
- Capability/accessibility interview beyond the implemented five-step setup wizard.

## Completed

- 2026-09-09: first-run setup wizard /setup-wizard (5 steps,
  low-cognition, skippable pieces; world.name fact + companion pref
  persisted on Finish; deep link from /login for fresh installs;
  11 tests pins structure).

- 2026-09-09 late: per-user preferences / journal paths behind
  PW_IDENTITY_MODE (issue #8 phase 1), /api/identity/principal
  read surface, step-up auth on prefs PUT, /api/journal pair
  route the caller's own tree. Tests: 335 passed.

- 2026-09-09 night (issue #8 phases 2+3): provisioning API
  (POST/GET/DELETE /api/identity/users, admin+step-up; token shown
  once, stored hashed); multi-mode bootstrap keeps the instance
  token as the primary person's credential; agents as owned
  principals with narrow scopes (read/write/journal/apps; token
  shown once); person-only guard refuses agents on prefs/journal;
  disable revokes access everywhere; 9 new tests prove the
  two-user acceptance core. Remaining for #8: provider-neutral
  OIDC attach, share-records UI. 361 tests passing.

- 2026-09-09 evening: subscription-usage card on Today (real Kilo
  data via the lab adapter); ChatContract.health seam; Wired the
  reminder scheduler to a single fastapi app; first-run runbook
  doc; loopback-or-private-only vault GET; source-control
  discover_repositories gains optional depth-limited recursion;
  GitHub issues #14, #15, #16, #17, #18 closed with evidence.
- 2026-09-06: core world model, CLI, API, dashboard shell, journal,
  exports, provider framework with zero-provider boot.
- 2026-09-06: standalone deployment, CI, security gates, license.
- 2026-09-06: design handoff, Figma roundtrip, canonical token
  reconciliation, companion character system, icon system, screen
  library.
- 2026-09-07: public-safety hardening, history sanitization,
  public-safety regression gate.
- 2026-09-09: container daily-use bring-up — in-container git for the
  native source-control baseline, MiMo cloud-chat verified live, real
  encrypted vault (issue: base64 fallback + missing `cryptography`
  found and closed), provider-key env passthrough, world seeded for
  first daily use, full suite green.
