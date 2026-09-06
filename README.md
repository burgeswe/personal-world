# Personal World

A small personal control plane: **stable truth, replaceable machinery.**

Personal World describes what exists (facts), what is wanted (intent),
what is allowed (policy), what it means (lore), what can act
(capabilities/providers), and what happened (journal) — and exposes
that truth through one core API consumed equally by CLI, dashboard,
and AI tools.

Status: V0 in active development. See `docs/ARCHITECTURE.md` (once it
lands) for the full model.

## Durable core

- schemas and contracts (facts, intent, policy, lore, capabilities,
  journal, packs, exports)
- capability and provider registries
- security classification (world / private / secret)
- journal — one append-oriented event stream, many renderers

## Not in the core

The core does not reimplement Git, Gitea, Komodo, systemd, Docker,
SOPS, OpenBao, OpenWebUI, LiteLLM, or any existing tool. Those are
providers, integrated through adapters — never runtime dependencies
of the generic core.

## Quick start (once V0 lands)

```bash
git clone <repo>
cd personal-world
docker compose up -d
```

Or locally:

```bash
personal-world init        # create local state (idempotent, zero providers)
personal-world daily       # the loop runs with no integrations connected
```

The core must boot and stay useful with zero optional providers
connected, and must remain correct with no AI model attached.
Capabilities are core-owned; providers (Gitea, Traefik, Komodo, ...)
are optional enrichments — see
`docs/NATIVE-BASELINE-AND-ENRICHMENT.md`.