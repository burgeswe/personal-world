# Agent Policy — Repository Decision Kernel

This is the mandatory entry point for AI agents working in this repository.

## Mandatory preflight

Before planning, researching, modifying, reviewing, merging, deploying, or declaring work complete:

1. Read the repository's canonical contract index.
2. Identify and read every contract applicable to the task.
3. Inspect current repository and runtime evidence before trusting handoffs, TODOs, or assumptions.
4. Reuse the existing canonical owner of a capability before creating another implementation.
5. Determine how compliance will be verified before making the change.

**Repository truth outranks inference. Unknown is a valid state. Make honesty cheaper than fabrication.**

## Decision rule

Prefer:

`inspect → verify → decide → change → prove`

over:

`assume → generate → hope`

When multiple designs work, prefer the one where:

- truth is easier to retrieve than fabricate
- safe behavior is easier than unsafe behavior
- accessible behavior is the default
- state is visible rather than remembered
- recovery is easier than heroics
- ownership is explicit rather than inferred
- deterministic behavior replaces unnecessary judgment
- unknown state remains visibly unknown
- evidence is cheaper than confidence
- one canonical interface is easier than competing interfaces
- humans can understand and recover the system without reconstructing agent history

## Contracts are requirements

The contract index determines which repository contracts govern the work.

Always consider applicability of:

- Human Reliability
- Accessibility
- security and secret handling
- architecture and ownership
- deployment and recovery
- public/private boundaries
- repository-specific operational contracts

Do not duplicate those contracts here.

Read and obey their canonical versions.

If a contract and an old handoff disagree, follow the canonical contract and current verified truth.

## Before changing anything

Answer:

### Truth
- What is currently true?
- What evidence proves it?
- Is the handoff older than repository or runtime state?
- Is this already implemented?

### Scope
- What is the smallest coherent change?
- What is explicitly out of scope?
- Which existing abstraction owns this responsibility?

### Safety
- What could break?
- Is the operation reversible?
- What must be preserved?
- What condition should make the agent stop?

## While working

Prefer extending existing capabilities over creating new:

- services
- containers
- databases
- dashboards
- CLIs
- agent frameworks
- settings systems
- backup systems
- state stores

Use explicit states such as:

- `UNKNOWN`
- `NOT_CONFIGURED`
- `DEGRADED`
- `BLOCKED`
- `DEFERRED`

Never convert uncertainty into success merely to finish a task.

Never expose credentials, secret values, resolved secret configuration, tokens, or sensitive payloads by default.

A running container is not proof of correctness.

HTTP 200 is not proof of semantic health.

Git equality is not proof of deployment.

A handoff saying something happened is not proof that it remains true.

## Human-facing work

All user-facing work must preserve the Accessibility and Human Reliability contracts.

Use progressive disclosure.

Keep important state understandable.

Do not rely on color alone.

Preserve accessibility floors.

Dangerous operations must be explicit and appropriately reversible.

## Definition of done

Code existing is not sufficient.

When applicable, completion includes:

`implement → test → document → review diff → PR → CI → merge → promote/deploy → verify runtime`

Before saying **done**, evaluate applicable contracts as:

- `PASS`
- `FAIL`
- `N/A`
- `UNKNOWN`

Never silently convert `UNKNOWN` into `PASS`.

Required `FAIL` means the work is not complete.

Required `UNKNOWN` means gather evidence or report the uncertainty.

## Final truth report

Substantial work should end with:

**CHANGED:** what actually changed  
**VERIFIED:** evidence gathered  
**CONTRACTS:** applicable contract status  
**UNKNOWN:** unresolved uncertainty  
**DEFERRED:** intentionally postponed work  
**NEXT:** next legitimate action, or `nothing required`

Stopping is valid.

`NEXT: nothing required` is a successful outcome.

## Core principle

> **Make honesty cheaper than fabrication.**

Do not depend on an agent being unusually careful.

Build and use systems where finding truth, following contracts, behaving safely, and proving the result are the easiest paths.
