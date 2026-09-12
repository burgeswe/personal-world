# Project Worlds — Documentation Index

(Formerly "Personal World" — product renamed 2026-09-12; technical identifiers unchanged.)

The map. Every document is one sentence away; depth lives behind the
links. If a path you need is missing from this index, that is a bug —
open an issue.

## Start here

| Doc | What it is |
|---|---|
| [README](../README.md) | The front door: what this is, quick start, navigation. |
| [CHANGELOG](../CHANGELOG.md) | Curated project milestones, newest first. |
| [ROADMAP](../ROADMAP.md) | Now / Next / Exploring — direction, not promises. |
| [PERSONAL-WORLD-FINISH-LINE.md](PERSONAL-WORLD-FINISH-LINE.md) | Canonical target daily-use experience; requirements, not implementation claims. |
| [PERSONAL-WORLD-COMPLETION-PLAN.md](PERSONAL-WORLD-COMPLETION-PLAN.md) | Canonical plan: current-vs-target audit, approved decisions, dependency-ordered phases P0–P14, acceptance criteria, model routing. |
| [p1/FOUNDATION-SPEC.md](p1/FOUNDATION-SPEC.md) | Approved P1 implementation contract: sections API, primitive contracts, parity checklist, bounded tasks. |
| [AGENT_POLICY.md](../AGENT_POLICY.md) | Mandatory agent preflight and decision policy. |
| [AGENT_CONTRACTS.md](../AGENT_CONTRACTS.md) | Canonical contract registry: applicability, authority, and exact entry points. |
| [STATUS.md](../STATUS.md) | Pointer to shared operational state; not deployment proof by itself. |
| [Contributing](../CONTRIBUTING.md) | How to propose changes (humans and agents). |
| [Security](../SECURITY.md) | Reporting boundaries and the public-repo safety contract. |

## Architecture

| Doc | Status | What it is |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Canonical current | World model, current APIs/layout, identity and Vault limits, daily loop, target auth distinction. |
| [NATIVE-BASELINE-AND-ENRICHMENT.md](NATIVE-BASELINE-AND-ENRICHMENT.md) | Normative | The core invariant: capabilities core-owned, providers optional. Enforced by `framework validate`. |
| [adr/0001](adr/0001-capabilities-core-owned-providers-optional.md) | Accepted | Why the capability-ownership rule became test-enforced. |
| [PROVIDERS.md](PROVIDERS.md) | Canonical | How to add a provider, step by step. |
| [OPERATIONS.md](OPERATIONS.md) | Canonical | Running it locally: CLI, web API, containers, health. |
| [OPERATIONS-FIRST-RUN.md](OPERATIONS-FIRST-RUN.md) | Operational reference | First-run procedure and dated bring-up evidence; reverify in the actual deployment. |
| [HUMAN_RELIABILITY_CONTRACT.md](HUMAN_RELIABILITY_CONTRACT.md) | Canonical | How the system stays safe and operable without demanding maximum operator attention. |
| [DESIGN-HANDOFF.md](DESIGN-HANDOFF.md) | V0.1 design baseline | Dated design-stage reference, not a current feature inventory; see README/Architecture for implemented scope. |

## Design

| Doc | Status | What it is |
|---|---|---|
| [tokens.json](../design/tokens.json) | Canonical | The repo-owned token file implementations consume. |
| [COMPANION_INTEGRATION.md](../design/COMPANION_INTEGRATION.md) | Canonical design + baseline/target notes | Five residents and identity design; current standalone Chat versus target contextual/global chat. |
| [THEME_PACK_FRAMEWORK.md](../design/THEME_PACK_FRAMEWORK.md) | Spec; partial implementation | Pack invariants; manifest registry exists, full frontend pack integration remains incomplete. |
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
| [SCREEN_READER_WALKTHROUGH.md](accessibility/SCREEN_READER_WALKTHROUGH.md) | Canonical current + requirements | Source labels/order, current gaps, target overlay semantics; not a manual speech transcript. |
| [RESPONSIVE_RULES.md](accessibility/RESPONSIVE_RULES.md) | Canonical current + requirements | Actual rail/banner/phone CSS cascade, accessibility requirements, target overlays. |
| [PREFERENCES_SCHEMA.json](accessibility/PREFERENCES_SCHEMA.json) | Canonical | The preference schema with its accessibility floor. |

## Development

| Doc | What it is |
|---|---|
| [AGENTS.md](../AGENTS.md) | Working-tree rules for agents and humans (worktrees, staging discipline). |
| [safe-commit.sh](../scripts/safe-commit.sh) | Stages named paths only; refuses unrelated-file sweeps. |
| [Validation commands](../README.md#validation-and-license) | `pytest`, `framework validate` — the canonical checks. |

## Status vocabulary used above

- **Canonical** — authoritative within its stated scope. Current descriptions,
  mandatory contracts, and target product requirements are distinct; an authoritative
  target does not prove implementation. Contradictions within scope are bugs.
- **Normative** — enforced by `personal-world framework validate` or tests.
- **Spec** — agreed direction; implementation may not exist yet.
- **Archived** — historical reference, preserved verbatim, do not edit.
