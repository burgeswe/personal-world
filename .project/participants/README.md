# Personal World — Participant Packs

One directory per regular collaborator: a shared boundary document —
"what does this participant and this project know about working together?"

Current packs:

| Participant | Type | Pack status | Contract gate | Commitment |
|---|---|---|---|---|
| `figma` | design-service | **ACCEPTED** | PASS | ACTIVE |

- 2026-09-12 (re-pass): Figma re-relayed her six corrected files in a
  second pass (9 + 6 task-impact sentences). The foreman verified her
  bundle identifiers and D0–D4 references against the canonical library
  on disk, applied her fully-specified corrections with provenance
  (`attestation.yaml`, `participant.yaml`, `capabilities.yaml`,
  `references.yaml`, `interaction.md`, `help-routing.yaml`), and promoted
  the pack: **ACCEPTED / PASS / ACTIVE**. See
  `figma/contract-return/RE-PASS.md` and
  `figma/help-response-write-persistence.json` for the full
  reported-complete → verified-not-on-disk → re-pass → verified → promoted
  lifecycle. This table previously lagged the promotion (stale pointer,
  corrected 2026-09-12 during a UI-convergence session cross-check).
- Acceptance is self-attested by Figma and hand-applied to disk by the
  foreman (her sandbox filesystem does not persist writes) — a recorded
  participant limitation, not wrongdoing. Treat her authority per
  `figma/participant.yaml`'s `authoritative_for` / `not_authoritative_for`
  regardless of gate status; a pack never overrides accessibility,
  runtime evidence, or repo-canonical token values.
- 2026-09-12 cross-check: `figma/references.yaml` had a structural YAML
  bug (44 of 47 frame entries were missing the `provenance:` parent key,
  making the file fail to parse) — fixed in place, re-validated (48
  entries, all with `provenance`, parses clean with PyYAML).
- A pack NEVER becomes canonical project truth. Deleting any pack directory
  must not corrupt this project.
- Packs carry no secrets — authentication is symbolic references only.