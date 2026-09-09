# Changelog

## 2026-09-09 — first-run wizard /setup-wizard shipped

### Added

- **A step-by-step first-run wizard for Personal World** for low
  cognition days: 5 short decisions, each skrippable; companions,
  token generation, optional vault passphrase, and a summary +
  Finish flow that start the dashboard. Uses the existing apliances
  contract; a11y contract kept (44px targets, dark, luminance only).

## Unreleased (2026-09-09 late)

### Added

- **Per-user preferences and journal isolation behind
  PW_IDENTITY_MODE.** Phase 1 of issue #8: /api/prefs and
  /api/journal pair route to the caller-person's own tree in
  multi mode; single mode returns the bootstrap-shared paths
  byte-identically. prefs PUT now requires step-up auth (same
  contract as journal write). Tests cover per-user isolation
  (alpha's scale never leaks to beta) and lazy-init absence
  as isolation proof.

Notable changes to Personal World. Entries are curated project
milestones, not a git-log dump. The project has no formal releases yet;
until a tagged release exists, the changelog tracks the evolving 0.1
development line on `main`.

## Unreleased

### Added

- **Figma-faithful dashboard theme (2026-09-07).** The dashboard now
  consumes the design truth the 0.1 pack shipped but never wired up:
  the 72px sidebar icon rail with 44px touch targets (top banner
  returns under 900px), self-hosted Young Serif display and Instrument
  Sans variable fonts (the `font.expressive`/`font.interface` design
  intent realized), the 72-glyph production icon sprite served at
  `/icons/sprite.svg`, the greeting block + motif-badge + section
  rhythm from `today-rylee-theme`, and the rylee accent corrected to
  the design's rose `#b57f8b` (replacing an invented pastel). New
  public routes serve only decorative static assets (icon sprite,
  OFL-licensed font binaries). Palette tokens in `design/tokens.json`
  are untouched; the accessibility floor is unchanged and all 25
  dashboard tests pass. Design source: Figma file VATVojyJZT9HKx0CrDS0yr
  frame 3:2147, extracted via the Figma MCP bridge 2026-09-07.
- **Accessibility contract discoverability + current-state entry point
  (2026-09-07).** The four canonical accessibility documents
  (`ACCESSIBILITY_CONTRACT.md`, `SCREEN_READER_WALKTHROUGH.md`,
  `RESPONSIVE_RULES.md`, `PREFERENCES_SCHEMA.json`) moved from
  `design/handoff/` (an Archived directory) to `docs/accessibility/`
  so the non-negotiable contract no longer sits inside a do-not-edit
  area. `AGENTS.md` now routes UI work to the contract directly. A new
  root-level `STATUS.md` is the current-state entry point: it answers
  "where do I look to know what is happening right now?" by deferring
  to the homelab repo's `docs/agent/CHECKOFF.md` instead of
  duplicating epoch state. Four new tests in `tests/test_docs.py`
  guard the canonical location, the AGENTS.md pointer, the STATUS.md
  pointer (and its no-duplicated-status rule), and block the archived
  copies from coming back. Repo truth stays single-sourced; the
  archived `design/handoff/` directory is now purely historical.
- **Chat surface with local-AI integration (2026-09-07).** Chat is a
  first-class dashboard destination backed by `POST /api/chat` and a
  provider-neutral `ChatContract`. Two adapters ship: `ollama`
  (Ollama's native API) and `openai_compat` (any OpenAI-compatible
  endpoint). The model observes a trimmed read-only world snapshot —
  capability statuses, actors, intents, policies, world-classified
  lore, recent journal events, source-repository summaries — and
  degrades honestly: `not_configured` with no provider, an inline
  error card when a model is unreachable. The core boots and stays
  fully usable with zero AI.
- **Dashboard rebuild on the canonical token system (2026-09-07).**
  Five-section navigation (Today, Chat, World, Journal, Settings),
  aubergine palette from `design/tokens.json`, status chips that lead
  with text words, journal kind-filtering, source-repository and
  update read views on World, and honest empty states throughout.
- **Companion runtime (2026-09-07).** The five approved companion
  source rigs ship byte-identical in the package and render at the
  brand lockup and Chat surface; companion selection and the Rylee
  accent palette are live preferences applied server-side and
  client-side.
- **Live preference editing (2026-09-07).** Text scale, density, touch
  targets, companion, and accent change the UI immediately and persist
  to the world state via `PUT /api/prefs`; the accessibility floor
  remains non-lowerable.
- `POST /api/chat`, the `reasoning` capability registry seam, and a
  19-test chat suite covering context trimming, private-lore
  exclusion, provider substitution, and fail-honest API behavior.

### Added (2026-09-08/09 — container bring-up session)

- **MiMo cloud-chat provider wired.** `openai_compat` connection to
  the Xiaomi MiMo endpoint ships as a private runtime config
  (`config/connections.local.json`, gitignored; template +
  `config/README.local.md` document the shape). Compose forwards the
  provider key by env indirection; no credential enters the repo.
- **Vault is real.** The vault endpoints were stubs returning
  hardcoded empties; now one persistent `Vault` instance backs
  unlock/lock/set/delete/names, secrets persist encrypted to
  `/data/vault.enc`, and setup-with-passphrase writes the encrypted
  file immediately. The Dockerfile installs the `cryptography` extra
  (was silently falling back to base64) and the lockfile carries the
  crypto deps (later bumped by dependabot to 50.0.0 with all gates
  green).

### Fixed (2026-09-08/09)

- Container didn't ship `git`, so the native source-control baseline
  reported `git binary not found` and the dashboard had no repository
  status. The image now installs git and the compose config points
  the native baseline at a container-internal clone
  (`/data/repos/personal-world`); source-control status/repro health
  verified live in-container.
- `compose.yaml` did not forward chat-provider API keys, so chat
  tested `401 Unauthorized` even with correct credentials. Keys now
  flow via env indirection (`XIAOMI_MIMO_API_KEY`), matching the
  provider contract's secret rule; chat verified working end-to-end
  (`mimo-v2.5-pro` replies through the container).
- Vault endpoints were stubs (see Added above).

### Changed (2026-09-08/09)

- Deployment image now installs `--extra test --extra crypto`;
  `uv.lock` refreshed to include `cryptography` (43.0.3 -> 50.0.0
  via dependabot PR #13).
- World seeded for daily use: 26 facts, 4 open intents, 4 policies
  (chat is read-only; private lore never exported; secrets never in
  chat context), 2 reminders (morning check-in, evening close-out).
- Repo state: GitHub + Gitea synced at `553e4b0`; CI green on every
  push of the session.

### Fixed

- Dashboard `load()` used `Promise.all()` on a plain object (not
  iterable), so every load threw and reported the core unreachable
  even when all APIs returned 200 (2026-09-07).

### Changed

- History sanitization: removed operator deployment endpoints and
  personal identifiers from the tracked default configuration and from
  the repository's public history (2026-09-07).
- The tracked `config/connections.json` now ships as a zero-provider
  baseline; an example file documents the wiring shape using reserved
  documentation hosts.
- New `tests/test_public_safety.py` regression gate blocks private
  endpoints (RFC1918 ranges and known operator hostnames) from
  re-entering shipped defaults.
- CI workflow actions bumped to current major versions
  (`actions/setup-python` v7).

## 2026-09-06 — the 0.1 bootstrap line

The repository went from empty skeleton to working application,
design system, and CI in a single day. Major milestones, in order:

### Added

- **Core world model** — facts, intent, policy, lore, capabilities,
  providers, journal, packs, and export contracts with
  world/private/secret classification (`feat(core)`).
- **Standalone deployment** — compose file, healthcheck, and CI
  workflow (`feat(deploy)`).
- **Live provider wiring** — Gitea and LangGraph adapters, gatus
  health fallback (`feat(lab-profile)`), later joined by a real
  LangGraph memory search provider with an epistemic taxonomy
  (`feat(memory)`).
- **Candy observation loop and dashboard foundation** — status
  vocabulary, stale semantics, attention items
  (`feat(v0.1)`).
- **Safe update flow** — check/preview/apply/verify/rollback
  (`feat(updates)`).
- **Presentation preference plumbing** with an enforced accessibility
  floor (`feat(prefs)`).
- **Native git-ish source control workflow** — zero-provider baseline
  for the source_control capability (`feat(source-control)`).
- **Framework tooling** — `personal-world framework validate`,
  design-tool independence tests, export portability gates
  (`feat(framework)`).
- **Apache-2.0 license** and integration leakage tests.
- **Design handoff for the Figma stage** — the sanitized product spec,
  operations guide, and the archived 0.1 spec package with Figma
  exports; canonical tokens reconciled to the aubergine palette.
- **Theme Pack Framework and personal theme pack specs** — swappable
  companion/palette packs that cannot modify the accessibility
  contract.
- **Companion character system** — five companion source rigs
  (Personal World, Mermaid, Little Helper Robot, World-tree Squirrel,
  Tacos & the Morning Paper), Lottie production lessons, the
  production icon system (72 deterministic SVGs), and the full
  Companion System & Chat architecture doc.
- **Screen SVG library** — Today/Journal/Settings/Chat screens across
  generic and personal themes, narrow and desktop layouts, with
  companion integration and chat navigation.
- **Public hardening pass** — visitor onboarding (README start-here
  table, CONTRIBUTING, SECURITY), issue/PR templates, Dependabot
  configuration, secret-pattern sanitization in test fixtures, pinned
  CI dependencies.

## Before 2026-09-06

The repository did not exist. There are no earlier releases, tags, or
hidden history: the first commit is `chore: bootstrap personal-world
repository skeleton` (2026-09-06).