# Personal World

A small personal control plane: **stable truth, replaceable machinery.**
A CLI, lightweight web dashboard and shared API describe what exists, what matters,
what is allowed, and what happened. Capabilities belong to the core; integrations
are optional providers.

**Status:** 0.1, active development. This public repository contains application
source, design contracts and showcase artwork. Design screens describe intended
experiences; they are not proof that every screen is implemented or deployed.
Private deployment configuration and personal data belong outside this repository.

## Start here

| Interest | Entry point |
|---|---|
| Understand the application | [Architecture](docs/ARCHITECTURE.md) and [native baseline](docs/NATIVE-BASELINE-AND-ENRICHMENT.md) |
| Explore the design | [Handoff index](design/handoff/README.md) and [frame index](design/handoff/FRAME_INDEX.md) |
| Browse companions and animation | [Asset index](design/assets/README.md) and [companion collection](design/assets/companions/README.md) |
| Run or configure it | [Operations](docs/OPERATIONS.md) and [providers](docs/PROVIDERS.md) |
| Contribute or get help | [Contributing and support](CONTRIBUTING.md) |
| Report a security concern | [Private security reporting](SECURITY.md) |

![Personal World companion artwork: robot, book-tree squirrel and taco news truck](design/assets/companions/companion-trio-preview.png)

## Try the CLI locally

Requires Python 3.12 or newer and [uv](https://docs.astral.sh/uv/getting-started/installation/).
Use a private local configuration directory for the zero-provider starting point:

```bash
git clone https://github.com/burgeswe/personal-world.git
cd personal-world
uv sync --frozen --extra test
uv run personal-world --config-dir config.local init
uv run personal-world --config-dir config.local daily
```

`data/` and `config.local/` are ignored runtime directories. Keep local endpoints
and credentials out of tracked examples. See [Operations](docs/OPERATIONS.md)
for the web API and container setup, including token creation and network scope.

## Durable core

- Facts, intent, policy, lore, capabilities, journal, packs and exports.
- Capability/provider registries with useful zero-provider behavior.
- World/private/secret classification and explicit mutation boundaries.
- One event stream shared by CLI, dashboard and AI tools.

The core does not reimplement Git, Gitea, Docker or a secret manager. Providers
enrich surviving core capabilities; no AI model or private service is required
for the standalone baseline.

## Validation and license

```bash
uv run pytest --timeout=30
uv run personal-world framework validate --json
```

Licensed under [Apache-2.0](LICENSE). The project is experimental; see the
[security policy](SECURITY.md) for the current support and deployment boundary.
