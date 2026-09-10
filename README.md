# Personal World

A small personal control plane: **stable truth, replaceable machinery.**
A CLI, lightweight web dashboard and shared API describe what exists, what matters,
what is allowed, and what happened. Capabilities belong to the core; integrations
are optional providers.

**Status:** 0.1, active development — [changelog](CHANGELOG.md) |
[roadmap](ROADMAP.md) | [finish line](docs/PERSONAL-WORLD-FINISH-LINE.md).
This public repository contains application source, design contracts and showcase
artwork. Design screens describe intended experiences; they are not proof that
every screen is implemented or deployed. Private deployment configuration and
personal data belong outside this repository.

## Why it exists

Most dashboards list installed services. Personal World answers a
person's actual questions — *what matters today, what changed, what
needs attention, what is my world allowed to do* — with the AI agent as
a first-class citizen that can observe and suggest, but never silently
decide. It is a single appliance: one person plus her agents, running
on her own hardware, with portable state she owns.

## What makes it different

| Idea | Where it lives |
|---|---|
| Facts / intent / policy / lore — the AI records, never invents | [Architecture](docs/ARCHITECTURE.md) |
| Capabilities core-owned; every provider swappable, nothing mandatory | [Native baseline](docs/NATIVE-BASELINE-AND-ENRICHMENT.md) (test-enforced) |
| Accessibility contract as a non-negotiable, pack-proof invariant | [Accessibility contract](docs/accessibility/ACCESSIBILITY_CONTRACT.md) |
| Five companion characters with semantic states, not status icons | [Companion system](design/COMPANION_INTEGRATION.md) |
| Zero-provider boot: the core survives every integration disappearing | [Operations](docs/OPERATIONS.md) |

## Start here

| Interest | Entry point |
|---|---|
| Understand the application | [Architecture](docs/ARCHITECTURE.md) and [native baseline](docs/NATIVE-BASELINE-AND-ENRICHMENT.md) |
| Understand the target daily-use experience | [Personal World finish line](docs/PERSONAL-WORLD-FINISH-LINE.md) |
| Explore the design | [Handoff index](design/handoff/README.md) and [frame index](design/handoff/FRAME_INDEX.md) |
| Browse companions and animation | [Asset index](design/assets/README.md) and [companion collection](design/assets/companions/README.md) |
| Everything, one page | [Documentation index](docs/INDEX.md) |
| Run or configure it | [Operations](docs/OPERATIONS.md) and [providers](docs/PROVIDERS.md) |
| Contribute or get help | [Contributing and support](CONTRIBUTING.md) |
| Report a security concern | [Private security reporting](SECURITY.md) |

![Personal World companion artwork: robot, book-tree squirrel and taco news truck](design/assets/companions/companion-trio-preview.png)

## What works today

Working and tested (CI-gated): the world model with classification and
cemented policies, CLI (17 commands), API with bearer-token auth, the
dashboard (Today, Chat, World, Journal, Settings) with real data
wiring and server-rendered preferences, the Chat surface over a local
model through a provider-neutral adapter (Ollama or any
OpenAI-compatible endpoint), five companion characters with runtime
selection, journal with kind filtering, source-repository status from
the native git baseline, the safe update flow's read views, all export
paths, and the framework validator.

Designed, not yet implemented: theme-pack loading as a runtime system
(companion selection and accent palettes are wired; full pack files
are not loaded yet) — tracked in the [roadmap](ROADMAP.md). The broader
daily-use completion target is defined separately by the
[finish line](docs/PERSONAL-WORLD-FINISH-LINE.md); it must not be read as
a claim that those target capabilities already exist.

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

## Validation and license

```bash
uv run pytest --timeout=30
uv run personal-world framework validate --json
```

Licensed under [Apache-2.0](LICENSE). The project is experimental; see the
[security policy](SECURITY.md) for the current support and deployment boundary.