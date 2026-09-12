# Personal World — Durable Project Context

This directory is Personal World's durable context under the Play-Nice
`project-context-and-participant-packs` framework (library v0.3.0).

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

See `participants/README.md`. Current packs: `figma` (status: proposed —
see its pack). Packs declare what the participant is authoritative for and
NOT authoritative for, and route help questions to whoever owns the answer.

## Provenance

Created 2026-09-12 by an integration session (opencode/glm) during the
Figma participant-pack integration pass, using
`contractctl init-project` from play-nice-contracts v0.3.0 @
`0c0ab7c5d03452fac1650260395b466305cdfa0a`. Session commitment bundle:
`quay-sail-tundra`.