# Personal World — Durable Project Context

This directory is Personal World's durable context under the Play-Nice
`project-context-and-participant-packs` framework (framework introduced
in library v0.3.0; adoption currently pinned to v0.5.0 — see
`contracts/adoption.yaml`).

## The three layers

```text
PLAY-NICE CONTRACTS   — how everybody should behave together (universal)
                       canonical library: burgeswe/play-nice-contracts
                       adopted at: contracts/adoption.yaml (revision pinned)
        ↓
PROJECT CONTEXT       — what this particular project is, wants, owns, uses
                       this directory + the repo files it points to
        ↓
PARTICIPANT PACKS     — optional knowledge supplied by tools/services/people
                       participants/<id>/ — enriches, never canonical
```

- **Contracts** live in the shared library; this repo consumes them via the
  adoption manifest (`.project/contracts/adoption.yaml`). Project-specific
  contracts (accessibility, human reliability, companion integration, the
  finish line) stay in their existing canonical homes (`docs/accessibility/`,
  `docs/HUMAN_RELIABILITY_CONTRACT.md`, `design/COMPANION_INTEGRATION.md`,
  `docs/PERSONAL-WORLD-FINISH-LINE.md`).
- **Project truth** stays where it already canonically lives — this directory
  adds pointers and a session-bootstrap entry point, it does not duplicate
  truth. When a pointer and a canonical file disagree, the canonical file
  wins.
- **Participant packs** (`.project/participants/<id>/`) are optional
  enrichment: deleting a pack removes convenience, never truth. A pack NEVER
  becomes canonical project truth unless the project explicitly promotes
  information from it.

## Session bootstrap

A new human/bot/agent session working on Personal World:

1. read `project.yaml` (this manifest) → `CURRENT.md` (where things stand);
2. resolve applicable Play-Nice contracts from the adoption manifest
   (`contractctl resolve --manifest .project/contracts/adoption.yaml --task ...`)
   against the canonical library, then attest and commit;
3. load this repo's own canonical contracts named in `AGENT_CONTRACTS.md`;
4. inspect applicable participant packs — load only the task-relevant ones;
5. work; leave durable evidence (provenance, handoffs).

## Participants

See `participants/README.md`. Current packs: `figma` (status: accepted —
see its pack; this line was stale until a 2026-09-12 cross-check, see
`participants/README.md` for the correction). Packs declare what the
participant is authoritative for and NOT authoritative for, and route
help questions to whoever owns the answer.

## Provenance

Created 2026-09-12 by an integration session (opencode/glm) during the
Figma participant-pack integration pass, using
`contractctl init-project` from play-nice-contracts v0.3.0 @
`0c0ab7c5d03452fac1650260395b466305cdfa0a`. Session commitment bundle:
`quay-sail-tundra`.

Adoption pin bumped 2026-09-12 (contract-refresh pass, bcode/claude) to
v0.5.0 @ `805f58b46fb59adefd1dee85dd99178d9dbaa1d9` — verified against
the live repository (commit + `contracts.lock.json` fetched and diffed,
not taken on assertion) before pinning. Delta from v0.3.0: two new
always-applicable contracts (`participation-and-contribution`,
`mutual-contribution`) and two version bumps within the existing bundle
(`ask-for-help` 1.0.0→1.2.0, `human-reliability` 1.0.0→1.1.0); the other
13 contracts already adopted are byte-identical at this revision. Both
new/changed contracts read in full; no conflict found with how this
project already operates (bounded worker delegation with independent
verification, honest refusal states, Figma's pack already describing
authoritative_for/not_authoritative_for boundaries, agreement never
treated as authorization). The Figma pack's own attestation
(`participants/figma/attestation.yaml`) is scoped to the prior revision
(receipt `nectar-heather-heather`, bundle `0c0ab7c5`) and is left
unedited — participant-supplied provenance is never rewritten on her
behalf (see `participants/figma/contract-return/NEXT-REVISION-NOTE.md`
for the honest gap this leaves and why it isn't blocking).