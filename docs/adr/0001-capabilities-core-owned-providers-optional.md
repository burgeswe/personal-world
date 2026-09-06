# ADR-0001: Capabilities are core-owned; providers are optional implementations or enrichments

- Status: accepted
- Date: 2026-09-06
- Supersedes: none
- Enforced by: `personal-world framework validate`, `tests/test_framework.py`
- Normative doc: `docs/NATIVE-BASELINE-AND-ENRICHMENT.md`

## Context

Personal World is designed as a small personal control plane: stable
truth (facts, intent, policy, lore, capabilities, journal) surrounded
by replaceable machinery (providers). The V0.1 implementation already
boots standalone with zero providers, but the architectural rule that
makes that property durable was prose only. Several painful patterns
motivated encoding it formally:

- **Provider lock-in.** When a capability is shaped by the provider
  that first implemented it (source control == Gitea), swapping the
  provider becomes surgery, and removing it deletes the user-facing
  concept.
- **Hidden infrastructure dependencies.** `depends_on: gitea` in the
  core compose file would quietly turn an "optional" integration into
  a boot requirement.
- **Losing OSS usefulness.** A generic repo should remain genuinely
  useful without a specific homelab, a paid service, or any particular
  ecosystem. Users vary: one runs Gitea/Traefik/Komodo, another runs
  GitHub/Caddy/compose, a nontechnical user runs nothing external at
  all.
- **Extraction pain.** Retrofitting optionality after the fact is the
  expensive migration pattern this repo family has repeatedly paid
  for; preventing it up front is cheaper.

## Decision

1. **Capabilities belong to the core.** A capability (`source_control`,
   `memory`, `journal`, ...) is a core-owned, provider-neutral contract.
   Providers implement or enrich capabilities; they never define them.
   The canonical model is `capability → native baseline → enrichment
   providers → specialist provider UI`.
2. **Native baseline, optional enrichment.** Each capability either
   ships a core-owned baseline with useful local meaning or reports
   explicit `not_configured`/`unavailable` states. Third-party
   providers add fidelity; their absence degrades gracefully and
   visibly, never silently and never fatally.
3. **Providers are optional by default.** A provider may be marked
   required only as an explicit, justified exception
   (`required: true` + `required_reason`) for a custom deployment.
4. **Provider data and actions are namespaced.** Generic capability
   state is portable; provider-specific details are optional
   enrichment. Deep work hands off to the provider's own UI.
5. **Design semantics are core-owned too.** Design truth lives in
   portable repo artifacts (`design/tokens.json`, the accessibility
   model); Figma/Penpot/code-first are interchangeable design
   providers, never canonical sources.
6. **Enforcement is executable.** The rules are validated by
   `personal-world framework validate` (connections, compose,
   exports) and the conformance suite (`tests/test_framework.py`),
   which proves core-only boot, provider add/remove/fail/substitute
   lifecycle, init idempotence, and secret-free registration.

## Consequences

- Adding a provider requires only: a declared capability, an adapter
  implementing its contract, and a connection entry validated
  against the framework. No core changes.
- The core compose file cannot grow provider boot dependencies;
  optional services are additive (profiles/overrides).
- Substitution (Gitea → GitHub → fake reference) is a first-class
  tested property, not an aspiration.
- Secrets stay env-indirected and brokered; the validator rejects
  inline secret material in provider registration.
- Future cost: every new capability needs a contract decision
  (native baseline or explicit not-configured semantics) before
  providers attach to it. That deliberateness is the point.