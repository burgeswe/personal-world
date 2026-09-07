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

- **Accessibility-preference → dashboard wiring.** The preference
  schema and accessibility floor exist and are enforced in tests; the
  dashboard currently renders the defaults. Wire user preferences into
  the rendered surface.
- **Theme Pack implementation.** The Theme Pack Framework
  (`design/THEME_PACK_FRAMEWORK.md`) and the personal Mermaid pack
  (`design/RYLEE_THEME_PACK.md`) are written as specs; the runtime does
  not yet load packs. Implement pack loading with the invariants the
  framework already fixes (accessibility contract untouched).
- **Chat surface.** The Companion System & Chat architecture
  (`design/COMPANION_INTEGRATION.md`) defines Chat as a first-class
  surface; the screens exist in `design/screens/`, the code does not.
  Implement the chat surface against the existing API.

## Next

Strongly relevant, clearly scoped, not started:

- **Scheduler/reminder engine.** The schema exists; no runner.
- **Source-control enrichment.** The Gitea adapter is health-only
  today; concept rollups ("3 repositories changed today") need read
  adapters.
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

- 2026-09-06: core world model, CLI, API, dashboard shell, journal,
  exports, provider framework with zero-provider boot.
- 2026-09-06: standalone deployment, CI, security gates, license.
- 2026-09-06: design handoff, Figma roundtrip, canonical token
  reconciliation, companion character system, icon system, screen
  library.
- 2026-09-07: public-safety hardening, history sanitization,
  public-safety regression gate.