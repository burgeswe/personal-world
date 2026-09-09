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

## Containers

The provided Compose file builds the API/dashboard appliance and persists state
in a Docker volume. Create `.env` from [env.example](../env.example), fill it with
a unique token, and keep it private.

```bash
cp env.example .env
# Set PW_API_TOKEN in .env using a private editor or secret-management workflow.
docker compose config -q
docker compose up -d --build
```

Review the Compose configuration first: its current port mapping publishes port
8000 on all host interfaces, and it mounts tracked `config/`. A local-only setup
should bind to `127.0.0.1` and mount your private configuration directory at
`/config:ro` in a local deployment copy. These are deployment choices; do not
assume the supplied Compose file is an internet deployment security boundary.
Remote use needs TLS, access controls and a reviewed authentication setup.

## Health, failures and state

`GET /healthz` is a public health endpoint; successful protected API access is a
separate check. The container refuses startup with an empty token. Docker health
status alone does not restart an unhealthy running container.

Unavailable providers must degrade honestly while core capabilities remain
usable. Missing providers are `not_configured`, not falsely healthy. The daily
loop is on request; it is not a background scheduler.

Back up the data volume securely before deployment changes. It contains world
state and the journal; deleting it can lose user-authored state and history.
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
