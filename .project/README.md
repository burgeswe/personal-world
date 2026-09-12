# Project Worlds — Durable Project Context

*(Renamed from "Personal World" 2026-09-12 — product identity only; the
project id, repo slug, and package names are unchanged. See
`CURRENT.md` "Identity pass" for the full classification.)*

This directory is this project's durable context under the Play-Nice
`project-context-and-participant-packs` framework (framework introduced
in library v0.3.0; adoption currently pinned to v0.6.0 — see
`contracts/adoption.yaml`).

## The three layers

```text
PLAY-NICE CONTRACTS   — how everybody should behave together (universal)
                       canonical library: Rylee-Bee/play-nice-contracts   # renamed from burgeswe/play-nice-contracts (account rename 2026-09-11); old URL still redirects
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

A new human/bot/agent session working on Project Worlds:

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
v0.5.0 @ `805f58b46fb59adefd1dee85dd99178d9dbaa1d9`, then bumped again the
same day (trunk-unification pass, bcode/claude) to **v0.6.0 @
`21b6841a50a1b0d459a760861385e99679852430`** — each bump verified
against the live repository (commit + `contracts.lock.json` fetched and
diffed, not taken on assertion) before pinning. v0.5.0 delta from v0.3.0:
two new always-applicable contracts (`participation-and-contribution`,
`mutual-contribution`) and two version bumps (`ask-for-help`,
`human-reliability`). v0.6.0 delta from v0.5.0: one new always-applicable
contract (`collaborative-good-faith`) and four version bumps
(`ask-for-help`, `mutual-contribution`, `participation-and-contribution`,
`orchestration`). Every new/changed contract read in full at each bump;
no conflict found with how this project operates. The Figma pack's own
attestation (`participants/figma/attestation.yaml`) is scoped to the
original revision (receipt `nectar-heather-heather`, bundle `0c0ab7c5`)
and is left unedited — participant-supplied provenance is never
rewritten on her behalf (see
`participants/figma/contract-return/NEXT-REVISION-NOTE.md` for the
honest, now three-revisions-wide gap this leaves and why it isn't
blocking).