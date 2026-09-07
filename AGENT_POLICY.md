# Agent Policy — Personal World Decision Kernel

This is the mandatory entry point for AI agents working on Personal World.

## Mandatory preflight

Before planning, researching, designing, modifying, reviewing, merging, or releasing:

1. Read the repository's canonical contract/index documentation.
2. Load every applicable contract, especially Accessibility and Human Reliability.
3. Inspect current repository behavior before trusting old handoffs or assumptions.
4. Identify whose state, data, or experience a change affects.
5. Determine how the result will be verified.

**Repository truth outranks inference. Unknown is a valid state. Make honesty cheaper than fabrication.**

## Product rule

Personal World is a personal appliance, not an administration console.

Technology should disappear behind understandable human concepts.

Prefer:

`human intent → native Personal World concept → adapter`

over:

`provider → provider-shaped UI`

Examples:

- source control, not a Gitea/GitHub clone
- health, not a Gatus clone
- deployment state, not a Komodo clone
- safe secret state, not a vault clone
- personal memory, not a vector-database console
- settings and drift, not a configuration-management dashboard

## Decision rule

Prefer designs where:

- the correct behavior is the easiest behavior
- truth is easier to retrieve than fabricate
- accessibility is the default
- private state is private by default
- ownership is explicit
- uncertainty remains visible
- recovery is understandable
- complexity is progressively disclosed
- users do not need infrastructure knowledge for ordinary use
- single-user operation stays simple even as multi-user capabilities grow

## Contracts are requirements

The canonical contract/index system governs decisions.

Always consider:

- Accessibility
- Human Reliability
- security/privacy
- identity and ownership
- public repository boundaries
- recovery and reversibility
- provider-neutral architecture

Do not duplicate canonical contracts here.

## Human experience

Before accepting a design, ask:

- What does the person think is happening?
- What actually is happening?
- Can those differ silently?
- What needs attention?
- What can safely wait?
- What is healthy?
- What is unknown?
- Can the person recover without understanding implementation internals?

Accessibility requirements are architectural requirements, not polish.

Do not weaken accessibility floors for visual preference or implementation convenience.

Use progressive disclosure.

Do not make the calm/simple interface dependent on hiding important truth.

## Ownership

For state that can become personal, always ask:

> Whose state is this?

Design new capabilities so identity, profile, ownership, permissions, memory, agents, integrations, preferences, and sharing can have explicit boundaries.

Do not create architecture that assumes all state is globally owned if it is reasonably likely to become user-specific.

## Security

Never expose:

- credentials
- tokens
- secret values
- resolved secret configuration
- private memory belonging to another boundary
- sensitive provider payloads

Fail closed when authorization or ownership is ambiguous.

Administrative capability must not automatically imply routine access to private content.

## Simplicity

Before adding a new service, framework, database, agent system, or UI, ask whether an existing Personal World or Lab abstraction already owns the responsibility.

Prefer:

- small files
- explicit schemas
- boring APIs
- deterministic logic
- native Personal World concepts
- provider adapters
- ordinary Git
- visible state

Do not introduce complexity merely because an AI agent can manage it.

## Definition of done

When applicable:

`implement → test → accessibility check → security/ownership check → docs → review → CI → merge → deploy → verify`

Evaluate relevant contracts as:

- `PASS`
- `FAIL`
- `N/A`
- `UNKNOWN`

Never silently convert `UNKNOWN` into `PASS`.

## Final truth report

Substantial work ends with:

**CHANGED:** actual changes  
**VERIFIED:** evidence  
**CONTRACTS:** contract status  
**ACCESSIBILITY:** relevant verification  
**OWNERSHIP/SECURITY:** relevant verification  
**UNKNOWN:** unresolved truth  
**DEFERRED:** intentional future work  
**NEXT:** legitimate next action or `nothing required`

## Core principle

> **Make honesty cheaper than fabrication.**

Personal World should make the safe, accessible, truthful, understandable path the natural path—for its users and for the agents building it.
