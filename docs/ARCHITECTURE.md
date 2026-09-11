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

## Durable memory and retrieval

Durable, human-readable files — especially Markdown — are preferred as
the canonical memory/lore truth where practical. They remain inspectable,
portable, versionable, and recoverable without a particular database or
provider.

Semantic-search indexes, vector stores, embedding stores, response caches,
and similar retrieval machinery are acceleration layers. They may be
implemented by replaceable providers and may be rebuilt from canonical
sources; they must not silently become the only authority for durable
memory. `/api/memory/search` is therefore a retrieval capability, not a
statement that the active memory provider owns the underlying truth.

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
- Secret handling has multiple explicit boundaries, described below. The broker
  path is not the only implemented secret path.

## Secrets: current implementation and target

`src/personal_world/vault.py` owns native `Vault`, backed by `vault.enc`,
and `VaultContract` (`get`, `set`, `delete`, `list_names`, `audit`). Native
Vault provides those operations; the API instantiates it directly once per app.
The UI unlocks with a master passphrase, lists names, and stores values without
redisplaying stored values. Locking clears decrypted in-memory state.

With the optional `cryptography` dependency installed
(`uv sync --frozen --extra crypto`), storage uses Fernet and a
PBKDF2-SHA256-derived key. The Dockerfile installs that extra. **Without that
dependency, current code falls back to base64, not encryption.** The status API
still returns `encrypted: true`; that field and the UI copy are not sufficient
evidence of encrypted storage. This is an implementation gap, not an acceptable
relaxation of the secret contract.

`providers/adapters.py::SopsBroker` is a separate pipe-to-consumer path.
`vault.py::SOPSVaultAdapter` is an implemented read-through adapter; writes and
deletes return unsupported and remain SOPS operations. No OpenBao adapter or
UI-selectable backend replacement is implemented. SOPS/OpenBao remain replaceable
provider paths in the target architecture; connecting them must preserve the
native concept and secret boundary rather than replacing it with a vendor UI.

All HTTP Vault routes require bearer authentication. Unlock requires a passphrase;
list/get require an unlocked vault. `GET /api/vault/{name}` returns a value only
after a peer-address check and records its name in the journal. Despite its
"loopback-only" error text, the check also accepts addresses Python classifies
as private. Set/delete/lock use bearer auth, not `require_step_up`. These are
current restrictions, not proof of finish-line re-authentication or per-user
Vault isolation. Never route retrieved values into model context or ordinary
exports/logs; secure retrieval is an explicit exceptional workflow.

## Auth

**Current implementation:** `require_auth` is the bearer/principal seam:
no instance token configured → protected routes 503; wrong token → 401.
`identity.py` resolves a `Principal` with identity, owner, scopes, authentication
level, and source. Default `PW_IDENTITY_MODE=single` resolves the bootstrap
primary person; optional `multi` uses local hashed user/agent token records.
Provisioning routes and selected per-user world/journal/preference paths exist.
Apps, Vault, reminders, and current Chat still use instance-level state; the
foundation is not a complete household isolation or SSO product.

`require_step_up` first requires bearer auth, then accepts loopback/test clients,
private peer addresses, or `X-PW-StepUp: 1`. It gates preference, Apps registry,
identity provisioning, and world-write routes. This is an implemented extra
write check, **not verified fresh authentication/MFA**. External forward-auth
may be a deployment layer, but it does not replace application authorization.

**Finish-line target:** authentication becomes provider-neutral at the
application seam. A real SSO/identity provider may supply normal sign-in,
while Personal World retains its own authorization/ownership rules. The
finished path must support step-up authentication for severe/destructive
changes and sensitive vault/secure-note access, plus recoverable
bootstrap/break-glass access when an external identity provider is
unavailable. The boundary must not depend on Authelia specifically and
should remain suitable for future non-browser clients. `require_auth`
remains the architectural seam unless implementation evidence justifies a
narrower refactor.

## API

One core, a FastAPI HTTP surface in `src/personal_world/api.py`, and a CLI
in `cli.py` sharing core modules. The CLI does not require an HTTP server.
The dashboard uses the API; future clients can use the same boundary.
The following inventory reflects implemented routes, not deployment acceptance:

| Route | Purpose |
|---|---|
| GET /healthz | Public liveness, auth_configured, setup_needed |
| GET /api/setup/status; POST /api/setup | Public first-run state/bootstrap; setup rejects repeats after the completion marker |
| GET /api/status | world summary + capability statuses |
| GET /api/daily | present the daily digest (read-only; never mutates) |
| POST /api/daily | run the daily loop: journal observations, record facts, save |
| GET /api/journal | recent events |
| POST /api/journal | User note append |
| GET /api/journal/audit | audit-log rendering |
| GET /api/actors | staff-directory view |
| GET /api/manifest | Core capability and provider manifest |
| GET /api/memory/search | semantic recall via the memory provider |
| POST /api/chat; GET /api/chat/providers | Read-only world-snapshot conversation and reasoning-provider status |
| POST /api/chat/test | Provider probe; currently has no require_auth dependency |
| GET /api/prefs; PUT /api/prefs | Read/save validated presentation preferences; writes use require_step_up |
| GET /api/apps; PUT /api/apps | Optional services launcher registry in data/apps.json; replacement is step-up gated and journaled |
| GET /api/source-control/status, /api/source-control/history, /api/source-control/rollups | Native repository status/history and optional forge rollups |
| GET /api/ingress/rollups | Optional ingress summary |
| GET /api/updates | Read-only update state, not a deploy action |
| GET /api/lab/state, /api/lab/settings, /api/lab/settings/inspect/{service}, /api/lab/settings/diff/{service} | Optional Lab state and configuration inspection |
| GET /api/lab/health, /api/lab/deploy, /api/lab/secrets, /api/lab/resources | Optional Lab read surfaces; secrets metadata, not resolved values |
| GET /api/vault/status, /api/vault/names, /api/vault/{name}; POST /api/vault/unlock, /api/vault/lock, /api/vault/set; DELETE /api/vault/{name} | Native Vault operations with the distinct restrictions above |
| GET /api/themes, /api/themes/{name} | Theme manifest registry reads; not full frontend pack integration |
| GET/POST /api/identity/users, /api/identity/agents; DELETE /api/identity/users/{user_id}, /api/identity/agents/{agent_id}; GET /api/identity/principal | Local identity/owned-agent foundations; user administration is admin-gated, agent operations use ownership, and writes use step-up |
| GET/POST /api/reminders; PATCH/DELETE /api/reminders/{rid} | Persistent reminders and scheduler controls |
| POST /api/world/intent, /api/world/fact, /api/world/policy | Explicit step-up-gated world writes, not model tools |
| GET /api/exports/settings | safe blueprint |
| GET /api/exports/world | portable personal config |
| GET /api/exports/story | human-readable journal |
| GET /api/backup | World/journal payload (encrypt externally); not a complete data-directory backup |

Unless explicitly labeled public above, API routes use bearer auth directly or
through `require_step_up`; individual routes may add further restrictions.
`/setup-wizard`, `/setup`, `/login`, `/`, and packaged fonts/icons/companions
are browser entry/assets. The five-step wizard collects welcome/name/companion/
access-token choices and finishes bootstrap; it is not the finish-line SSO or
capability/accessibility interview. `POST /api/setup` can initialize Vault too.
Review first-run exposure separately from normal protected API access.

### Known implementation/documentation boundaries

- The design preference schema includes motion choices beyond `reduced`, while
  `prefs.py` currently accepts only `reduced`. The default agrees; the full design
  schema is not a promise that every preference is writable today.
- Accessibility contract section 1.3 lists text statuses but omits `warning`,
  which exists in `status.py`. Treat that contract as requiring explicit labels,
  not as a replacement enum; provider status authority remains `status.py`.
- The registry merges `connections.local.json`, but the source-control rollup
  endpoint reads `connections.json` directly. Private override behavior is not
  uniform across all read surfaces. Configure privately and verify each surface.
- The tracked Compose has host-specific bind mounts despite its standalone
  description. Parsing/framework success does not establish portable deployment.

These gaps are recorded rather than changing implementation or weakening an
adopted contract during documentation reconciliation. Manual screen-reader,
deployed SSO, strong step-up, external Vault substitution, complete multi-user
isolation, and full-instance restore acceptance require separate evidence.

## Daily loop

OBSERVE → VALIDATE → RECONCILE → DISCOVER → POLICY → JOURNAL → PRESENT.
Deterministic. Correct with zero providers and no AI. The reasoning
capability is optional and replaceable (local model, cloud, or none).

## Provider substitution proof

`source_control` has two providers through one `SourceControlContract`:
real Gitea (HTTP API) and a deterministic fake reference. Tests prove
the registry transparently substitutes an unavailable real provider with
the fake (`tests/test_core.py::TestProviderSubstitution`).

## Export contracts

| Command | Artifact | Contains | Never contains |
|---|---|---|---|
| settings-export | shareable blueprint | capabilities, providers, packs, policy defaults | facts, intent, lore, any personal data |
| world-export | portable personal config | intents, policies, world-classified lore | secrets, private lore |
| backup | World/journal recovery payload (encrypt with your SOPS/age) | serialized world and journal, including private state | not shareable; does not include all runtime files |
| story-export | human-readable journal | narrative events, disclosure-filtered | private events unless explicitly included |

`backup_payload` does not package `vault.enc`, identities, Apps registry,
reminders, per-user directories, or runtime configuration as a full instance
archive. A recovery plan must cover those separately and verify restoration.

## Lore states and the existing epistemic vocabulary

The lab already runs a de-facto epistemic taxonomy across three
systems — rylee_lore claim states (`candidate/accepted/superseded/
rejected/unknown`), rylee-context provenance triples (`source ×
confidence × status`), and VEFR's propose-validate-apply Spark
contract. Personal World's lore states (`confirmed/derived/suggested/
ephemeral`) align with all of them, and the shared promotion rule is
identical everywhere: **agents append evidence; only an explicit human
action promotes to canon.** The core's `MutationDenied` gate enforces
that rule structurally for every caller.

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
  app.py              core capability definitions + provider wiring
  providers/          contracts, registry, adapters.py (Gitea/HTTP/fake/SOPS),
                      optional Lab, forge, and ingress enrichment adapters
  api.py              FastAPI + bearer auth + dashboard shell
  cli.py              personal-world CLI (--json envelope)
  loop.py             the daily cycle
  status.py           canonical provider/capability statuses + ranking
  prefs.py            validated presentation preferences and CSS attributes
  chat.py             provider-neutral chat transport
  chat_context.py     read-only world snapshot for model context
  chat_registry.py    chat provider configuration helpers
  vault.py            native Vault, VaultContract, read-through SOPS adapter
  identity.py         principal resolution + local hashed-token identity store
  user.py             per-user paths and ownership foundations
  source_control.py   native read-only local Git baseline
  updates.py          update planning/read state
  scheduler.py        persistent reminders + background scheduler
  theme_pack.py       manifest loading/registry (partial runtime integration)
  init.py             zero-provider initialization
  framework.py        framework validation and manifest rules
  static/             packaged companion SVGs, icons, fonts
config/connections.json   provider wiring (no secrets inline)
data/                  ignored private runtime state (never public content)
docs/                  architecture, contracts, operations, finish-line intent
design/                tokens, current design references, artwork
design/handoff/        archived design package (do not modify)
tests/                 security + safety + persistence suites
compose.yaml           the supported standalone deployment
```

Runtime files include `world.json`, `journal.ndjson`, `vault.enc`, `users.json`,
`apps.json`, `reminders.json`, setup markers, and optional theme-pack/per-user
directories. Concrete runtime locations depend on data/config configuration;
private files are not application source or public repository fixtures.
