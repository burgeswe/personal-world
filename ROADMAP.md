# Roadmap

Direction, not promises. Personal World is developed by one human with
an AI-agent workflow; items move between horizons freely and nothing
here is a delivery commitment. Dates exist only where a milestone has
already happened.

Grounding: every item below is recovered from the design handoff's
engineering-requirements section, implemented-but-incomplete seams in
the code, or explicit spec documents — not invention.

## Now

Work that completes or hardens what 0.1 already promises:

- **Secret vault.** DONE (2026-09-09): Fernet-encrypted file vault
  (`/data/vault.enc`, PBKDF2-600k) behind real unlock/lock/set/
  delete/names endpoints; the image now installs `cryptography` so
  the base64 fallback silently weakened it no longer. Values never
  render; only names list.

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
- **Theme Pack implementation.** Partially done (2026-09-07):
  companion selection and accent palettes are wired through the
  preference system with approved art served from the package. Still
  open: loading full pack files (state poses, per-pack icon families)
  from `design/THEME_PACK_FRAMEWORK.md`'s manifest format.

## Next

Strongly relevant, clearly scoped, not started:

- **Source-control enrichment.** The Gitea adapter is health-only
  today; the native git baseline now feeds dashboard + chat context.
  Concept rollups ("3 repositories changed today") can deepen with
  commit-activity reads.
- **Ingress rollups.** "14 routes healthy / 1 cert needs attention"
  needs a Traefik capability provider; the semantic seam is recorded
  in the design handoff.
- **"Last observed" age display** for stale surfacing.
- **Quick actions** — the write path plus step-up-auth groundwork.
- **Apps/Services launcher** — needs an apps registry concept.

## Exploring

Preserved ideas, no commitment:

- Open design questions from the Figma stage (navigation style,
  density, mascot microcopy, personal-mode presentation) — see the
  design handoff's open-questions section.
- OIDC/passkey auth as provider-aware work on the `require_auth` seam.
- Mobile-specific responsive behavior (design screens deliberately
  stop at narrow-desktop).
- Interview wizard / onboarding accessibility interview.

## Completed

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