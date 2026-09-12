# Operations guide (0.1)

> **First run on new hardware?** See
> [`docs/OPERATIONS-FIRST-RUN.md`](OPERATIONS-FIRST-RUN.md) — the
> daily-use runbook matching what was actually done.

This guide describes the public standalone application. Keep private deployment
hostnames, service inventories, credentials and access procedures in private
operator documentation.

## Local CLI, zero optional providers

From the repository root, install the locked dependencies and initialize a private
local config directory:

```bash
uv sync --frozen --extra test
uv run personal-world --config-dir config.local init
uv run personal-world --config-dir config.local daily
```

Initialization is idempotent and does not overwrite existing configuration.
`config.local/` and `data/` are ignored by Git. Add optional providers only to your
private configuration; use [provider contracts](PROVIDERS.md) as the reference.
The tracked `config/connections.json` is separate from this local configuration.

## Local web API

Generate a unique token into your shell environment, without printing it:

```bash
export PW_API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export PW_CONFIG_DIR="$PWD/config.local"
export PW_DATA_DIR="$PWD/data"
uv run uvicorn personal_world.api:create_app --factory --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/`. Protected API requests need the bearer token.
Do not publish tokens in URLs, screenshots, shell transcripts or public issues.
The core rejects protected requests with no configured token and compares supplied
tokens in constant time. Forwarded identity headers do not bypass this check.

The browser also has `/setup-wizard`, `/setup`, and `/login` entry points.
First-run setup and `/api/chat/test` are currently public routes; protected-route
authentication does not cover them. See [Architecture](ARCHITECTURE.md) for the
route inventory and the limits of the current extra write check called step-up.
It is not verified SSO/MFA re-authentication.

Native Vault needs `uv sync --frozen --extra test --extra crypto` for encrypted
storage in a local install. The Dockerfile already installs the crypto extra.
Without it, current Vault code falls back to base64 while its status endpoint
still reports encrypted; do not use that response alone as encryption evidence.

### Frontend serving (transitional)

During P1 the server has two serving modes, chosen by the `PW_FRONTEND`
environment variable:

- `legacy` (default): the built-in server-rendered HTML pages are served
  exactly as before. Nothing changes for existing deployments.
- `react`: the server serves the built React interface from a dist
  directory instead of the built-in HTML pages.

`PW_FRONTEND_DIST` points at a built `dist/` directory. It defaults to
`frontend/dist` relative to the repository in a local install and
`/app/frontend/dist` in the container image, where the image build
produces it. When the dist directory has no `index.html`, page requests
answer `503` with an HTML explanation ("Project Worlds' interface is
not built") and the API remains fully available; the response never
contains filesystem or environment values.

The default stays `legacy` for all of P1; it flips to `react` at the P1
parity cutover. No action is needed now.

## Containers

The provided Compose file is the portable appliance: it pulls the published
GHCR image and persists state in a Docker volume. No source tree, no homelab
checkout, no Kilo auth file, and no WSL paths are required to boot.

```bash
export PW_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
docker compose pull
docker compose up -d
docker compose ps
```

Then open `http://127.0.0.1:8000/`. A local-only setup should bind to
`127.0.0.1` instead of `0.0.0.0`; remote use needs TLS, access controls, and a
reviewed authentication setup — these are deployment choices, not defaults in
the tracked Compose.

### Image tags

| Tag | Source | Use |
| --- | --- | --- |
| `ghcr.io/rylee-bee/personal-world:latest` | Each successful main publish | Convenience tag for fresh installs |
| `ghcr.io/rylee-bee/personal-world:sha-<full SHA>` | Same publish | Immutable; preferred for reproducible deploys and rollback |

Pin `latest` for ordinary use. Pin a `sha-...` tag when you need a
reproducible deployment or want to roll back to a known-good image.

### Rollback

```bash
PW_IMAGE=ghcr.io/rylee-bee/personal-world:sha-<known-good> \
    docker compose up -d
```

Or set `PW_IMAGE` in `.env` and `docker compose up -d`. No separate rollback
machinery is needed.

### Local development (build from source)

The portable base only ever pulls. To iterate against the Dockerfile and
the live code without a GHCR push, use the dev override:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

The dev override sets `build: .`, `image: personal-world:dev`, and
`pull_policy: never` — it never reaches GHCR. Developers do not need to
edit the production Compose file.

### Optional Rylee / homelab enrichment

The portable base does not bind any host paths. On the laptop / homelab
host that has the kilo2/homelab checkout and a Kilo auth file, opt in
with the homelab override (read-only binds, no other changes):

```bash
docker compose -f compose.yaml -f compose.homelab.yaml up -d
```

Outside that host, do not use this override. Both bind paths in it are
machine-specific and intentionally non-portable.

## Health, failures and state

`GET /healthz` is a public health endpoint; successful protected API access is a
separate check. The container refuses startup with an empty token. Docker health
status alone does not restart an unhealthy running container.

Unavailable providers must degrade honestly while core capabilities remain
usable. Missing providers are `not_configured`, not falsely healthy. The daily
loop is on request. A separate reminder scheduler now runs with the API process;
it does not turn the daily loop into a scheduled job.

Back up the data volume securely before deployment changes. It contains world
state, journal, Vault, identities, Apps registry, reminders, and optional per-user
state; deleting it can lose user-authored state and history. `/api/backup` exports
world/journal data only, not a full data-volume backup.
Do not put backups, journal exports or diagnostic dumps in this public repo.

## Chat (optional local AI)

The Chat surface is a provider-neutral conversation over a read-only
world snapshot. With no chat provider configured the capability reports
`not_configured` and every other surface works unchanged; an unreachable
model degrades to an honest inline error, never a fake reply.

Wire a provider in your **private** runtime config
(`config.local/connections.json`), never the tracked default:

```json
{
  "$schema": "personal-world/connections/1",
  "connections": [
    {
      "type": "ollama",
      "name": "local-qwen",
      "capability": "reasoning",
      "base_url": "http://127.0.0.1:11434",
      "model": "qwen3:8b",
      "timeout": 300
    }
  ]
}
```

`type` is `ollama` (Ollama's native `/api/chat`) or `openai_compat` (any
OpenAI-compatible `/v1/chat/completions` endpoint — llama.cpp server,
LiteLLM, vLLM). API keys for remote endpoints use env indirection:
`"api_key_env": "MY_KEY_ENV"` (see the framework secret rule; the
provider never reads the value into settings or exports). `timeout` is
seconds; generous values suit CPU-only inference where a cold 8B model
load can take minutes.

The model observes a trimmed text snapshot of your world (capability
statuses, actors, intents, policies, world-classified lore, recent
journal events, source-repository summaries) plus the last six chat
turns. Private-class lore and secret material are never included. The
chat path is read-only: there is no tool execution and no state
mutation from chat.

## Updates and validation

Fetch and review upstream changes in a clean deployment checkout. Preserve local
config and state; do not overwrite them with repository examples. Review migrations
and take a backup before rebuilding. Never embed repository credentials in images
or remote URLs.

```bash
uv run pytest --timeout=30
uv run personal-world framework validate --json
```

These are local checks. Verify authentication, health, provider behavior and
backup recovery in the actual deployment before treating an update as accepted.
