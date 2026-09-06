# Operations Guide (V0.1)

How Personal World runs day to day in the operator's lab, and how it fails.

## Deployment shape

| Surface | Where | Auth |
|---|---|---|
| Dashboard | `https://world.example.invalid` | Authelia SSO (one_factor) + inner bearer token |
| API (LAN tooling) | `http://192.0.2.10:8000` | bearer token (`PW_API_TOKEN` in `/opt/flags.env`) |
| CLI | `lab status` / `lab daily` (homelab repo) | `PW_TOKEN` env, optional |
| Standalone dev | `docker compose up -d` in this repo | `PW_API_TOKEN` env, fail-closed |

The homelab deployment lives in the homelab repo
(`compose/personal-world.yml`, config at `config/personal-world/`).
This repo stays generic: no lab URLs in the core, all provider
endpoints come from `config/connections.json` at deploy time.

## Compose lifecycle

```text
host starts -> compose starts (restart: unless-stopped)
    -> healthcheck /healthz -> healthy
    -> dashboard available through Traefik+Authelia
    -> providers reconnect (fail-soft; see below)
    -> scheduled activity resumes (V0.1: on-request only; no cron yet)
```

State persists on the `personal_world_data` volume (world.json +
journal.ndjson). Recreating the container preserves both. If the
volume is wiped, Personal World boots as an empty world — providers
re-observe and the journal restarts; nothing else is lost because
the world is rebuildable from observation.

## Outage and fallback behavior

| Failure | Behavior |
|---|---|
| Personal World down | nothing else in the homelab changes; `lab status`/`lab daily` print an explicit `unavailable` row, exit 1, never fake health |
| Provider down (candy, langgraph, gitea) | capability shows `unavailable`/`needs_attention` (status word, never fake-healthy); core and other providers unaffected |
| Auth proxy down | dashboard unreachable through SSO; LAN API path (`:8000`) still serves `lab` CLI |
| No token configured | all protected routes 503 (fail closed) |
| Empty/new world | boots green; capabilities `not_configured`; journal says so |
| Stale observation | `world.stale_capabilities(max_age)` surfaces age explicitly; unknown is never healthy |

## Candy Dispenser observation seam

Candy's health port (`:5126`) is container-internal only — reachable
from Personal World because both containers share the external
`proxy` docker network. Personal World reads `GET /health` and keeps
only operational counters (notifications_sent, errors, grabs,
sources, seen_count); indexer/client names and personal-discovery
tunables are deliberately dropped by the adapter. No new network
exposure; no writes; `--once`/`--force` modes are never invoked.

## Auth flow (bootstrap vs production)

- **Bootstrap/dev**: `PW_API_TOKEN` bearer only (fail-closed 503/401).
- **Production (lab)**: Traefik forwards `world.*` to Authelia
  (one_factor, `group:users`); after SSO the dashboard still requires
  the inner bearer token for `/api/*` — the proxy is not trusted to
  be the only gate. Forged `Remote-User` headers never authenticate
  (the core ignores forwarded identity entirely; only the inner token
  opens the API).
- Future seam: step-up auth / passkeys arrive via Authelia policy
  (e.g. two_factor rule for `world.*`), not via new core code.

## Lab CLI relationship

`lab status` and `lab daily` (homelab `scripts/lab_personal_world.py`)
are thin read-only HTTP clients. Personal World is optional: with it
stopped, every other `lab` subcommand is unaffected, and status/daily
degrade to a one-row explicit-unavailable matrix. `PW_URL`/`PW_TOKEN`
env overrides exist for testing; defaults target the VM deployment.

## Deploying updates to the VM (private-repo fetch)

The production checkout is `/opt/personal-world-src` on the stack VM
(`homelab-vm`, 192.0.2.10). The remote points at the LAN-direct
Gitea URL — this is deliberate, not a workaround:

```text
origin  http://192.0.2.20:3000/rylee/personal-world.git
```

Authentication uses the `tea login helper` git credential helper
(`tea logins list` on the VM shows the `homelab` login). Fetch and
fast-forward are the whole deploy:

```bash
ssh homelab-vm 'git -C /opt/personal-world-src fetch origin main \
  && git -C /opt/personal-world-src merge --ff-only origin/main'
cd /opt/personal-world-src && docker compose up -d --build
```

`--ff-only` is the safety property: a diverged or dirty checkout
fails loudly instead of clobbering local state. Do not bake
credentials into images or add an embedded-token remote; the
credential helper reads the existing `tea` login. No deploy script
lives in this repo — deployment is two SSH commands, documented here.

## LangGraph networking decision

The memory provider reaches LangGraph at
`http://192.0.2.10:18000` (`config/connections.json`, `base_url`)
— a host-IP URL, not a compose service name. This is a considered
decision, kept because the alternatives add fragility:

- The seam is already env-free config, not hardcoded: point
  `base_url` at any reachable URL and the adapter follows. No code
  change is ever needed to re-target it.
- A compose network alias would couple this standalone repo to the
  homelab's docker network topology (`langgraph` runs in a different
  compose project; joining their network from this repo violates the
  standalone framework rule that providers never become boot
  dependencies).
- The URL is verified reachable from inside the container; host-IP
  routing works on this LAN and needs no privileged DNS.

If LangGraph ever moves hosts or ports, edit
`config/connections.json` — one line, deploy, done.

## Verifying health

```bash
curl -s http://192.0.2.10:8000/healthz     # {"ok":true,...}
lab status                                    # world matrix
lab daily                                     # what matters today
docker inspect personal-world --format '{{.State.Health.Status}}'
```

## Framework conformance

Architecture invariants (capabilities core-owned, providers
optional/replaceable, no inline secrets, export portability,
design-tool independence) are enforced, not aspirational:

```bash
uv run personal-world framework validate --json   # {"ok":true,"data":{"count":0}}
uv run pytest                                      # includes test_framework.py
```

`GET /api/manifest` exposes the capability manifest: what each
capability is, its contract, native baseline presence, active
provider, provider mode/replaceability, and expected behavior when
the last provider is removed. The dashboard and `lab` CLI should
read capability state from the API/manifest rather than hard-coding
provider assumptions. Normative doc: `docs/NATIVE-BASELINE-AND-ENRICHMENT.md`.

## Known limitations (V0.1)

- Daily loop runs on request; no scheduler/cron yet.
- Single user; no multi-tenant anything, by design.
- `secrets` capability has a broker contract but no live provider.
- Journal renderers are text; the dashboard reads the same journal.
- Accessibility preferences exist as world schema (`accessibility`
  block) but the dashboard does not yet honor them per-user — that
  wiring lands with the design epoch.