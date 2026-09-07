# Personal World — Documentation Index

The map. Every document is one sentence away; depth lives behind the
links. If a path you need is missing from this index, that is a bug —
open an issue.

## Start here

| Doc | What it is |
|---|---|
| [README](../README.md) | The front door: what this is, quick start, navigation. |
| [CHANGELOG](../CHANGELOG.md) | Curated project milestones, newest first. |
| [ROADMAP](../ROADMAP.md) | Now / Next / Exploring — direction, not promises. |
| [Contributing](../CONTRIBUTING.md) | How to propose changes (humans and agents). |
| [Security](../SECURITY.md) | Reporting boundaries and the public-repo safety contract. |

## Architecture

| Doc | Status | What it is |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Canonical | World model, security classification, API, daily loop. |
| [NATIVE-BASELINE-AND-ENRICHMENT.md](NATIVE-BASELINE-AND-ENRICHMENT.md) | Normative | The core invariant: capabilities core-owned, providers optional. Enforced by `framework validate`. |
| [adr/0001](adr/0001-capabilities-core-owned-providers-optional.md) | Accepted | Why the capability-ownership rule became test-enforced. |
| [PROVIDERS.md](PROVIDERS.md) | Canonical | How to add a provider, step by step. |
| [OPERATIONS.md](OPERATIONS.md) | Canonical | Running it locally: CLI, web API, containers, health. |
| [DESIGN-HANDOFF.md](DESIGN-HANDOFF.md) | Canonical (V0.1) | The implemented product as designed for the Figma stage. |

## Design

| Doc | Status | What it is |
|---|---|---|
| [tokens.json](../design/tokens.json) | Canonical | The repo-owned token file implementations consume. |
| [COMPANION_INTEGRATION.md](../design/COMPANION_INTEGRATION.md) | Canonical | Companion System & Chat architecture: five residents, sizes, identity layers. |
| [THEME_PACK_FRAMEWORK.md](../design/THEME_PACK_FRAMEWORK.md) | Spec (implemented pack loading: no) | What a theme pack may and may not change. |
| [RYLEE_THEME_PACK.md](../design/RYLEE_THEME_PACK.md) | Spec | The personal Mermaid theme pack. |
| [LOTTIEFILES_HANDOFF.md](../design/LOTTIEFILES_HANDOFF.md) | Canonical | Production lessons for Lottie Creator workflows. |
| [Asset index](../design/assets/README.md) | Canonical | Icons, companion rigs, the Mermaid master animation. |
| [Companion collection](../design/assets/companions/README.md) | Canonical | Source rigs and per-companion animation handoffs. |
| [Screen library](../design/screens/) | Canonical | Today/Journal/Settings/Chat screens, both themes, narrow + desktop. |
| [Exports (0.1)](../design/exports/0.1/) | Canonical visual source | The Figma export set the palette reconciliation targeted. |
| [handoff/](../design/handoff/README.md) | Archived | The original 0.1 spec package, preserved verbatim. Canonical accessibility docs now live under [docs/accessibility/](accessibility/ACCESSIBILITY_CONTRACT.md). |

## Accessibility

| Doc | Status | What it is |
|---|---|---|
| [ACCESSIBILITY_CONTRACT.md](accessibility/ACCESSIBILITY_CONTRACT.md) | Canonical (all 9 sections) | The non-negotiable accessibility contract. |
| [SCREEN_READER_WALKTHROUGH.md](accessibility/SCREEN_READER_WALKTHROUGH.md) | Canonical | Announced experience, screen by screen. |
| [RESPONSIVE_RULES.md](accessibility/RESPONSIVE_RULES.md) | Canonical | Breakpoints and adaptation rules. |
| [PREFERENCES_SCHEMA.json](accessibility/PREFERENCES_SCHEMA.json) | Canonical | The preference schema with its accessibility floor. |

## Development

| Doc | What it is |
|---|---|
| [AGENTS.md](../AGENTS.md) | Working-tree rules for agents and humans (worktrees, staging discipline). |
| [safe-commit.sh](../scripts/safe-commit.sh) | Stages named paths only; refuses unrelated-file sweeps. |
| [Validation commands](../README.md#validation) | `pytest`, `framework validate` — the canonical checks. |

## Status vocabulary used above

- **Canonical** — describes current truth; contradictions are bugs.
- **Normative** — enforced by `personal-world framework validate` or tests.
- **Spec** — agreed direction; implementation may not exist yet.
- **Archived** — historical reference, preserved verbatim, do not edit.