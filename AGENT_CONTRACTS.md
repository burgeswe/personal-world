# Agent Contract Index

Project Worlds uses canonical contracts to define how humans and AI
agents work within it.

Before substantial work, read this index and load every contract
applicable to the task.

Do not rely on remembered versions of these contracts when the
repository contains a current copy.

## Operating Order

For each task:

1. Read [`AGENT_POLICY.md`](./AGENT_POLICY.md) and
   [`AGENTS.md`](./AGENTS.md).
2. Read this index.
3. Load the contracts marked **Always**.
4. Load additional contracts whose trigger matches the work.
5. Inspect relevant current state before planning mutations.
6. Perform the work under those contracts.
7. Verify the resulting state.
8. Preserve meaningful provenance.

Contracts are operating constraints, not background reading.

## Contract Registry

### Accessibility

- **Applies:** Always
- **Purpose:** Accessibility requirements are architectural
  requirements, not polish. Governs visual experience, screen-reader
  experience, responsive behavior, and the preference accessibility
  floor.
- **Contract:** [`docs/accessibility/ACCESSIBILITY_CONTRACT.md`](docs/accessibility/ACCESSIBILITY_CONTRACT.md)
  — canonical, all 9 sections.

Companion canonical sources, governed by the same contract:

- [`docs/accessibility/SCREEN_READER_WALKTHROUGH.md`](docs/accessibility/SCREEN_READER_WALKTHROUGH.md) — announced experience, screen by screen.
- [`docs/accessibility/RESPONSIVE_RULES.md`](docs/accessibility/RESPONSIVE_RULES.md) — breakpoints and adaptation rules.
- [`docs/accessibility/PREFERENCES_SCHEMA.json`](docs/accessibility/PREFERENCES_SCHEMA.json) — preference schema with its accessibility floor.

Load the canonical contract in full before designing or implementing
anything a person perceives or interacts with.

### Human Reliability

- **Applies:** Always
- **Purpose:** Governs cognitive load, visible state, calm defaults,
  honest status (`PASS` / `FAIL` / `N/A` / `UNKNOWN`), recoverability,
  and healthy agent/human collaboration.
- **Contract:** [`docs/HUMAN_RELIABILITY_CONTRACT.md`](docs/HUMAN_RELIABILITY_CONTRACT.md)

The contract was extracted verbatim-in-meaning from `AGENT_POLICY.md`,
which continues to state the policy from the agent's side.

### Public Repository Boundary

- **Applies when:** Work touches tracked files, endpoints, credentials,
  personal data, or deployment topology in any way.
- **Purpose:** No private endpoints, credentials, personal data, or
  deployment topology in any tracked file. Fail closed when ownership
  or authorization is ambiguous.
- **Contract:** [`SECURITY.md`](./SECURITY.md)

Regression gate: `tests/test_public_safety.py`.

### Provider-Neutral Baseline

- **Applies when:** Work adds or changes capabilities, providers, or
  anything that could make a vendor's shape into product truth.
- **Purpose:** Capabilities are core-owned; providers are optional.
  User-facing meaning stays provider-neutral; provider-specific data
  is namespaced, never canonical.
- **Contract:** [`docs/NATIVE-BASELINE-AND-ENRICHMENT.md`](docs/NATIVE-BASELINE-AND-ENRICHMENT.md)
  — normative, enforced by `personal-world framework validate`.

Rationale: [`docs/adr/0001-capabilities-core-owned-providers-optional.md`](docs/adr/0001-capabilities-core-owned-providers-optional.md).

## Contract Discovery Rule

If this repository defines additional contracts, add them to this
registry with exactly four pieces of information:

1. Name
2. Trigger — when must it be loaded?
3. Purpose — what does it govern?
4. Location — where is the authoritative contract? (exactly one
   authority per contract; a summary may be listed alongside it,
   but it routes, it does not govern)

Keep summaries short. Do not duplicate the full contract in this
index.

## Instruction Precedence

Follow higher-authority runtime/platform instructions first.

Within the repository, use this order unless the repository explicitly
defines a stricter policy:

```text
repository-specific mandatory instructions
        ↓
applicable adopted contracts
        ↓
task-specific documentation
        ↓
historical context and journals
```

Historical context never overrides freshly verified current state when
describing what is true now.

If two applicable instructions genuinely conflict:

1. identify the conflict;
2. preserve both requirements;
3. prefer the safer or more restrictive interpretation when possible;
4. do not silently discard either;
5. escalate when the conflict cannot be resolved safely.

`design/handoff/` is an archived spec package — historical, never edit
it to change design. The four canonical accessibility files above live
under `docs/accessibility/`, outside that archive.

## Loading Discipline

Load what applies. Do not load everything merely because it exists.

An infrastructure-only task may need the Public Repository Boundary
and Provider-Neutral Baseline contracts but no screen-level
accessibility detail.

A user-facing task normally needs Accessibility and Human Reliability
at minimum.

This keeps agent context small while preserving governing constraints.

## Source Discipline

When a contract exists in this repository, read the repository version.

Do not substitute:

- conversational memory;
- an older handoff;
- a copied version from another project;
- an agent's remembered summary;
- a summary file when the contract names a different authoritative
  source.

Cross-project canonical sources may be used only when the repository
explicitly points to them.

## Summary Rule

A contract entry in this registry names exactly one authoritative
source. Where the registry also names a summary (a shorter file for
quick orientation), the summary exists to route, not to govern. When
a summary and its authoritative source disagree, the authoritative
source wins without requiring anyone to reconcile them first.

## Completion Check

Before declaring substantial work complete, verify:

| Check        | Question                                                    |
| ------------ | ----------------------------------------------------------- |
| Contracts    | Were all applicable contracts loaded?                       |
| Contracts    | Were their acceptance requirements followed?                |
| Truth        | Was relevant current state inspected?                       |
| Truth        | Was the resulting state verified?                           |
| Provenance   | Can the next person or agent determine what changed and why? |
| Continuity   | Did the work leave the project understandable and safe to continue? |

If not, the task is not complete.

## Agent Directive

Treat applicable contracts as part of the operating environment for
this task. Do not merely summarize or cite them. Use them to make
decisions.

When uncertain:

1. Observe truth first.
2. Preserve uncertainty honestly.
3. Consult the applicable contract.
4. Prefer reversible action.
5. Verify what happened.
6. Leave useful evidence behind.
