# Personal World Architecture

Stable truth. Replaceable machinery.

## The one idea

A personal control plane with a small durable core — schemas, observed
facts, intent, policies, lore, capability/provider registries, journal,
packs, export contracts — surrounded by replaceable providers that do
the actual work. The core never reimplements Git, Gitea, GitHub,
Komodo, systemd, Docker, SOPS, OpenBao, OpenWebUI, LiteLLM, or any
existing tool. Those are providers behind adapters.

## World model

| Concept | Meaning | Mutated by AI? |
|---|---|---|
| Fact | Observed reality, with provenance | records, never invents |
| Intent | What the user wants true | never — explicit only |
| Policy | Hard rules (deny/allow), cementable | never — explicit user action only |
| Lore | Contextual meaning: confirmed / derived / suggested / ephemeral | suggests; never silently confirms |
| Capability | What the world can do (provider-neutral) | no |
| Provider | Concrete system mapped to a capability | no |
| Journal | One append-oriented event stream | records |
| Pack | Recipe: structure, never personal data | installs defaults only |

## Security classification

- `world` — portable structured state (personal data, not public)
- `private` — personal context; stricter access and export rules
- `secret` — credential material; never enters model context, never
  serialized by any export; consumed only through the broker

Classification is field metadata in the model
(`src/personal_world/classification.py`), not folder boundaries.

## Security model

- The AI is not a security boundary. The dashboard is not a security
  boundary. Packs are not trusted because installed.
- Authorization happens before sensitive retrieval or action.
- `settings-export` is a **whitelist walk**: only fields marked
  `exportable` can ever serialize. Leakage tests insert fake names,
  emails, tokens, passwords, and private lore into every record class
  and prove they cannot appear (`tests/test_core.py::TestSettingsExportSafety`).
- Cemented policies reject every non-user mutation path: API, imports,
  packs, discovery, automation (`tests/test_core.py::TestCementedPolicy`).
- Secrets flow through a broker (`providers/adapters.py::SopsBroker`):
  values are piped to consumers, never returned to callers.

## Auth

Bearer token boundary (fail-closed): no token configured → protected
routes 503; wrong token → 401. In-lab deployments can instead put the
whole thing behind Authelia forward-auth (one compose label) — the app
does not care where the boundary lives. OIDC/passkeys are future
provider-aware work; the seam is the single `require_auth` dependency.

## API

One core, one API (`src/personal_world/api.py`). CLI, dashboard, and
future AI/bot/VEFR clients consume identical endpoints:

| Route | Purpose |
|---|---|
| GET /healthz | liveness + auth_configured (no secret material) |
| GET /api/status | world summary + capability statuses |
| GET /api/daily | run/present the daily digest |
| GET /api/journal | recent events |
| GET /api/journal/audit | audit-log rendering |
| GET /api/actors | staff-directory view |
| GET /api/exports/settings | safe blueprint |
| GET /api/exports/world | portable personal config |
| GET /api/exports/story | human-readable journal |
| GET /api/backup | full backup payload (encrypt externally) |

## Daily loop

OBSERVE → VALIDATE → RECONCILE → DISCOVER → POLICY → JOURNAL → PRESENT.
Deterministic. Correct with zero providers and no AI. The reasoning
capability is optional and replaceable (local model, cloud, or none).

## Provider substitution proof

`source_control` has two providers through one `SourceControlContract`:
real Gitea (HTTP API) and a deterministic fake reference. Tests prove
the registry transparently substitutes an unhealthy real provider with
the fake (`tests/test_core.py::TestProviderSubstitution`).

## Export contracts

| Command | Artifact | Contains | Never contains |
|---|---|---|---|
| settings-export | shareable blueprint | capabilities, providers, packs, policy defaults | facts, intent, lore, any personal data |
| world-export | portable personal config | intents, policies, world-classified lore | secrets, private lore |
| backup | DR payload (encrypt with your SOPS/age) | everything | (it IS everything — never share) |
| story-export | human-readable journal | narrative events, disclosure-filtered | private events unless explicitly included |

## Repository layout

Mirrors the conventions proven in the homelab monorepo: hatchling +
`src/` package, optional `test` dependency group, pinned image tags,
healthchecks on every container, env-indirected secrets, dry-run by
default, verdict-in-body JSON envelopes.

```text
src/personal_world/   core package
  model.py            world model (facts/intent/policy/lore/...)
  world.py            container + mutation gates
  classification.py   world/private/secret metadata
  journal.py          append-only event stream + renderers
  export.py           the four export contracts
  providers/          capability contracts + registry
  adapters.py         gitea, http_status, fake, sops broker
  api.py              FastAPI + bearer auth + dashboard shell
  cli.py              personal-world CLI (--json envelope)
  loop.py             the daily cycle
config/connections.json   provider wiring (no secrets inline)
tests/                 security + safety + persistence suites
compose.yaml           the supported standalone deployment
```