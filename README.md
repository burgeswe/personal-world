# Project Worlds

*(Formerly "Personal World" — renamed 2026-09-12 after the T1–T14 trunk
was unified; same codebase, same continuity line, no repository/package
rename yet. See `.project/CURRENT.md` for what changed and what
intentionally didn't.)*

A calm, accessible, slightly whimsical personal environment where your
information, tools, assistant, history, and capabilities come together
naturally — and where sophisticated machinery stays out of your way
until you actually need it. Understandable at a glance when you can
barely focus; fully inspectable down to the technical guts when you want
that instead.

**Status:** 0.1, active development — [changelog](CHANGELOG.md) |
[roadmap](ROADMAP.md) | [finish line](docs/PERSONAL-WORLD-FINISH-LINE.md).
This public repository contains application source, design contracts and showcase
artwork. Design screens describe intended experiences; they are not proof that
every screen is implemented or deployed. Private deployment configuration and
personal data belong outside this repository.

## Why it exists

Most dashboards list installed services. Project Worlds answers a
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
| Understand the target daily-use experience | [Project Worlds finish line](docs/PERSONAL-WORLD-FINISH-LINE.md) |
| Explore the design | [Handoff index](design/handoff/README.md) and [frame index](design/handoff/FRAME_INDEX.md) |
| Browse companions and animation | [Asset index](design/assets/README.md) and [companion collection](design/assets/companions/README.md) |
| Everything, one page | [Documentation index](docs/INDEX.md) |
| Run or configure it | [Operations](docs/OPERATIONS.md) and [providers](docs/PROVIDERS.md) |
| Contribute or get help | [Contributing and support](CONTRIBUTING.md) |
| Report a security concern | [Private security reporting](SECURITY.md) |

![Project Worlds companion artwork: robot, book-tree squirrel and taco news truck](design/assets/companions/companion-trio-preview.png)

## What works today

Implemented in the current source, with repository tests and CI gates:

- World model, classification, cemented policies, CLI, daily loop, exports,
  and the framework validator; core operation does not require a provider.
- Dashboard pages **Today, Chat, World, Journal, Vault, Settings**, real data
  loading, explicit partial/error states, journal notes and kind filtering.
- Server-rendered and live presentation preferences with validated writes
  behind the current step-up check; five selectable companions and accent palettes.
- Optional read-only Chat over a world snapshot through Ollama or an
  OpenAI-compatible provider. It returns conversation text, not tool execution.
- Services launcher with an editable Apps registry, plus persistent reminders
  that the background scheduler records in the journal.
- Five-step first-run setup wizard, access-token login/bootstrap, and optional
  Vault initialization through the setup API.
- Native Vault UI/API for unlock/lock, names, storage, and deletion. Encrypted
  storage requires the optional crypto dependency (included by the Dockerfile);
  minimal installs otherwise use an unencrypted fallback. See the
  [current secret boundary and limitations](docs/ARCHITECTURE.md#secrets-current-implementation-and-target).
- Local identity foundations: principal resolution, hashed user/owned-agent
  tokens, provisioning, and selected per-user state paths in optional multi mode.
  This is not complete SSO, household isolation, or strong re-authentication.
- Native Git status/history, optional forge and ingress rollups, Lab read
  surfaces, and read-only update information; availability depends on configuration.
- Theme manifest loading/registry APIs. Full custom-pack asset/state integration
  in the frontend remains incomplete; built-in companion/palette choices work.

Repository tests do not prove every external integration or deployed user
journey. The [Architecture](docs/ARCHITECTURE.md) records current auth, Vault,
state ownership, API, and backup limits. The [finish line](docs/PERSONAL-WORLD-FINISH-LINE.md)
defines the broader target: contextual chat and tools across sections, verified
SSO and stronger step-up, native daily-use workspaces, backend switching, and
deeper customization. Those are not completed by the current foundations.

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
