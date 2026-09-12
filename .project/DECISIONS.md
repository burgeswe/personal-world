# Project Worlds — Durable Decisions

Decisions that are RESOLVED and durable — the "why it is this way"
record. Current implementation state lives in
[`.project/CURRENT.md`](./CURRENT.md); the cooperation constitution
lives in [`contracts/adoption.yaml`](./contracts/adoption.yaml)
(Play-Nice Contracts, upstream at
[github.com/Rylee-Bee/play-nice-contracts](https://github.com/Rylee-Bee/play-nice-contracts)).

Each entry records the decision, the date, and the standing reason.
Nothing here is silently reopened; changing a decision means a new
dated entry superseding the old one (append-only, like the journal).

## Product identity

- **2026-09-06 — Capabilities are core-owned; providers are optional
  implementations or enrichments.** (ADR-0001) The core must survive
  the disappearance of every optional integration; enforced by
  `personal-world framework validate` and `tests/test_framework.py`.
  Reason: a personal control plane must never become a disguised
  dependency on one external system.

- **2026-09-12 — The product is "Project Worlds"; the companion
  character keeps the name "Personal World."** "Project Worlds is the
  environment; Personal World is the companion inside it." Technical
  identifiers intentionally stay `personal-world` (repo slug,
  `personal_world` package, `personal-world` CLI, compose services,
  schema URIs); historical references are preserved rather than
  rewritten. Reason: continuity of tooling and truthful history
  outweigh cosmetic consistency.

- **2026-09-12 — Project Worlds publicly identifies as a Play-Nice
  product.** Play-Nice Contracts are the shared cooperation and
  engineering constitution (how Rylee, Personal World, agents, and
  providers work together). Play-Nice does not own product identity,
  data, UI, or domain behavior. Adoption is evidenced by the
  repository itself; no certification or endorsement is claimed.
  Reason: the cooperation floor should be explicit, shared, and
  linkable, not implicit.

- **2026-09-12 — Local Git truth is canonical for source control;
  GitHub is optional remote enrichment.** Local Git answers
  existence, branch, dirty state, ahead/behind, and history; GitHub
  (via the authenticated `gh` CLI — no second credential system) only
  adds remote facts (identity, open PRs/issues, default branch, last
  push) and degrades quietly when absent. The Gitea enrichment
  provider was retired from the live architecture the same day; the
  generic forge adapter remains as substitution-proof registry
  machinery. Reason: local truth survives the remote provider.

## Journal

- **2026-09-12 — Journal corrections are append-only supersessions,
  never rewrites.** A corrected entry links back via `supersedes`;
  the original row is never mutated on disk; currency is derived by
  readers; chains are linear (branching rejected); idempotent retries
  return `already_applied`. Reason: correct the record without
  erasing the record.

- **2026-09-12 — Agreement is not authorization.** Every journal
  mutation (corrections included) goes through the step-up-gated
  endpoint after an explicit approval press on a WHAT/WHY/ORIGINAL/
  PROPOSED/EFFECT/RISK/RECOVERY proposal. Assistant-drafted
  correction proposals (same day) follow the same boundary: Personal
  World may draft and explain, the owner reviews/edits/approves, and
  the audit records "proposed by Personal World (assistant draft),
  approved by the owner." Reason: helpful is not the same thing as
  authorized.

- **2026-09-12 — GitHub open-PR and open-issue counts are exact or
  unknown.** Counts come from GitHub search `total_count` (never a
  `per_page`-bounded list length, which caps at 100); any search
  failure yields honest `null` counts, never zeros. Reason: an
  approximation that presents itself as exact is a lie.