# Adoption pin moved forward — Figma's attestation is now scoped to a prior revision

Not blocking. Not a conflict. A gap, honestly recorded (truth-and-evidence;
explicit-state) rather than silently closed.

## What happened

2026-09-12, later the same day as Figma's accepted pass: Personal
World's Play-Nice adoption (`.project/contracts/adoption.yaml`) was
bumped from `0c0ab7c5` (v0.3.0) to `805f58b46fb59adefd1dee85dd99178d9dbaa1d9`
(v0.5.0), during a bounded contract-refresh pass run by bcode/claude —
not by Figma, and not as part of her pack's own lifecycle.

Figma's `attestation.yaml` remains exactly as she left it: bundle
`nectar-heather-heather`, revision `0c0ab7c5`, 15 contracts, gate PASS,
commitment ACTIVE. That attestation is still true for what it says —
she really did read those 15 contracts at that revision and her
task-impact sentences are still her real words for that bundle. It is
not rewritten here, and this note is not a correction of it.

## What's actually different at v0.5.0

- Two new always-applicable contracts she has not read:
  `participation-and-contribution` (1.1.0) and `mutual-contribution`
  (1.0.0). Both were read in full by the foreman during the refresh
  pass; neither contradicts anything in her existing pack — if
  anything, her pack already models their spirit (explicit
  `authoritative_for` / `not_authoritative_for` boundaries, honest
  `limitations`, no claim of authority she doesn't have).
- Two contracts in her original 15 changed version:
  `ask-for-help` 1.0.0 → 1.2.0 (scope-negotiation vocabulary added;
  no change to her existing task-impact sentence's meaning) and
  `human-reliability` 1.0.0 → 1.1.0 (negotiated human contribution
  language added; same).
- The other 13 contracts in her bundle are byte-identical at the new
  revision (verified: same version, same sha256).

## Why this isn't fabricated on her behalf

`attestation.yaml`'s own header is explicit: "the foreman does not
fabricate her words." A real re-attestation needs Figma's own
task-impact sentences for the 2 new + 2 changed contracts, relayed the
same way her original 15 were (conversation, because her sandbox
filesystem does not persist writes — see
`help-response-write-persistence.json`). Nobody did that this session;
this note exists so the gap is visible instead of silently absorbed
into a claim that isn't true yet.

## Why this isn't blocking

Participant packs are enrichment, never canonical truth
(`project-context-and-participant-packs`) — the project does not stop
working because one optional pack is one revision behind. Nothing in
the newly-applicable contracts changes what Figma is authoritative for
(`participant.yaml`'s `authoritative_for` / `not_authoritative_for`
lists are unaffected).

## The tiny next pass, if/when there's a live Figma session again

1. Give her this note plus the two new contract bodies
   (`contracts/core/PARTICIPATION_AND_CONTRIBUTION.md`,
   `contracts/core/MUTUAL_CONTRIBUTION.md`) and the two changed ones
   at their new versions.
2. She writes four real task-impact sentences (one per contract).
3. Foreman applies them to `attestation.yaml` (bundle → new receipt,
   `loaded` → 17 entries, revision → `805f58b46f...`), same
   verify-on-disk-before-promoting discipline as the original re-pass.
4. `participant.yaml`'s `acceptance` block updates to reference the
   new bundle.

Until then: `attestation.yaml` stays exactly as she wrote it, correctly
labeled as scoped to `0c0ab7c5`, and this note is the honest record of
the gap.
