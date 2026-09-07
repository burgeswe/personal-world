# Changelog

Notable changes to Personal World. Entries are curated project
milestones, not a git-log dump. The project has no formal releases yet;
until a tagged release exists, the changelog tracks the evolving 0.1
development line on `main`.

## Unreleased

### Fixed

- History sanitization: removed operator deployment endpoints and
  personal identifiers from the tracked default configuration and from
  the repository's public history (2026-09-07).
- The tracked `config/connections.json` now ships as a zero-provider
  baseline; an example file documents the wiring shape using reserved
  documentation hosts.
- New `tests/test_public_safety.py` regression gate blocks private
  endpoints (RFC1918 ranges and known operator hostnames) from
  re-entering shipped defaults.

### Changed

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