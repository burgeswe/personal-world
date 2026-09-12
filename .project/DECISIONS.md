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
  rewritten. Reason: continuity of tooling and truthful history.

## Source of truth

- **2026-09-12 — Project Worlds does not compute repository
  publication state itself. It consumes the read-only agent-sync
  project-state interface.** `agent-sync status --all --format json`
  (the pickle project's adapter layer, schema
  `play-nice/repo-status-v1`) is the single authoritative interpreter
  of Rylee's project estate: Git owns Git truth; agent-sync computes
  publication/safe-to-leave/work-state from it; Project Worlds'
  `AgentSyncProjectSensor` only invokes, parses, and normalizes that
  observation (unknown preserved, closed vocabularies enforced,
  exit-1 treated as a valid work-to-do signal); Projects presents,
  Today summarizes, Personal World explains. No second Git-state
  implementation exists inside Project Worlds, and an agent-sync bug
  is recorded + deferred to pickle, never worked around by
  duplicating Git logic. Reason: one computation, one authority —
  drift between tools showing "project state" is a truth failure
  no UI can repair.

- **2026-09-12 — Personal World may understand project state without
  gaining repository mutation authority.** The chat context carries a
  bounded read-only projection of the agent-sync observation; the
  assistant may summarize, explain, compare, and point to Projects.
  It may NOT push, commit, reset, rebase, stash, or clean, and no
  conversational phrasing is interpreted as Git authorization. The
  projects slice added understanding only, not capability; mutation-
  oriented proposal objects are out of scope until a real,
  owner-authorized Projects mutation workflow exists to prepare into.
  Reason: helpful understanding and dangerous reach must be built as
  separate layers — the seam stays closed until it can open with
  provenance.

- **2026-09-12 — Project-state truth and project-state freshness are
  separate dimensions.** WHAT agent-sync observed (publish_state,
  safe_to_leave, tree counts) and WHEN it observed it
  (`observed_at`, rendered as age) never collapse into each other:
  a stale observation of "diverged" is still a diverged observation,
  just not current evidence — staleness never converts state to
  unknown, and state never hides age. The stale marker is calm
  provenance ("may be stale"), never error vocabulary. Reason: old
  evidence is not false evidence, but it must never impersonate
  current evidence — and confusing the two dimensions would lie in
  both directions at once.

- **2026-09-12 — Project Worlds preserves the observation timestamp
  from agent-sync instead of presenting cached/previous observations
  as timeless current truth.** agent-sync's own `observed_at` is the
  only freshness source (no second clock, no freshness database, no
  polling); age is DERIVED at render time (backend
  `agent_sync.freshness()`, ONE frontend helper
  `lib/observation-age.ts`), the staleness threshold reuses the
  product-wide lab_state 30-minute `FRESHNESS` convention
  (asserted by test; no settings surface), and missing/invalid
  timestamps render as honestly unknown rather than fabricating an
  age. Every project-status surface (Projects glance + guts, Today,
  the assistant context) shows WHEN the estate was observed so the
  user never mistakes an old observation for current truth. Reason:
  truth has a timestamp; the UI must carry it, not invent it.


## Container distribution

- **2026-09-12 — Project Worlds is distributed as a versioned OCI
  image through GitHub Container Registry.** The portable Compose
  deployment consumes the published image; machine-specific
  integrations live in optional overrides. Tags: `:latest`
  (mutable convenience, refreshed on each successful main publish)
  and `:sha-<full SHA>` (immutable; documented rollback handle).
  Workflow `.github/workflows/publish-image.yml` triggers via
  `workflow_run` after `validate` passes on `main`; it uses
  `GITHUB_TOKEN` with `packages: write` + `contents: read`, no PAT.
  Compose layout: `compose.yaml` is the portable base (image-only,
  no host paths); `compose.dev.yaml` adds `build: .` for local
  development; `compose.homelab.yaml` carries the optional Rylee-only
  enrichment (Lab CLI + Kilo auth file) that previously lived in the
  base file. Rollback by pinning `PW_IMAGE` to a known-good
  `:sha-...` tag. Reason: a single CI build produces an appliance
  that boots on any Docker/Podman host with only a token and a data
  volume; the previous recipe required cloning the source tree and
  binding WSL-only host paths, both of which made the appliance
  non-portable in practice despite its header.

- **2026-09-12 — The published image is `linux/amd64` only.** The
  single host that currently runs Project Worlds is amd64; ARM is not
  in scope. Multi-arch would roughly double CI build cost and time
  without a real consumer. Revisit when an ARM deployment target
  appears. Reason: cheapest path that still meets the actual use;
  Play-Nice `dependency-discipline` and `search-before-inventing`
  forbid speculating complexity.

- **2026-09-12 — The GHCR package is public.** The image carries
  source only — no secrets, no private endpoints, no deployment
  topology (verified preflight against `SECURITY.md` and
  `tests/test_public_safety.py`). Discoverability is a feature, not a
  boundary. Reversible from the GHCR web UI at any time. Reason:
  no security boundary is crossed by publishing the source image
  publicly; private visibility would add an access-handling layer
  for no defensive gain.
