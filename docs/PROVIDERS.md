# Writing a Provider

A provider maps one capability to one real system, without modifying
that system. The core never requires any specific provider.

Capabilities are core-owned; your provider implements or enriches one
(see `docs/NATIVE-BASELINE-AND-ENRICHMENT.md` and
`docs/adr/0001-capabilities-core-owned-providers-optional.md`).

## 1. Pick or define a capability

Capabilities live in `src/personal_world/app.py::define_standard_capabilities`.
If yours is new, add it there with a one-line description.

## 2. Implement a contract

```python
from personal_world.providers.registry import StatusContract
from personal_world.envelope import Result, ok

class MyThing(StatusContract):
    def __init__(self, base_url: str, token_env: str = "MY_TOKEN"):
        self.base_url = base_url
        self.token_env = token_env

    def observe(self) -> Result:
        # read-only; return ok("healthy", data={...}) or fail(...)
        ...
```

Rules:

- `observe()` is read-only. Writes need an explicit approval path.
- Fail closed: catch your own errors and return `Result(ok=False,
  status="unhealthy"|"unavailable")`. Never raise through the registry.
- Secrets come from env indirection (`token_env`), never literals.
- Never return secret values in `data`.

## 3. Wire it in `build_registry`

Add a branch in `src/personal_world/app.py::build_registry` keyed on a
`type` string, then declare connections in `config/connections.json`:

```json
{
  "connections": [
    {"type": "mything", "name": "my-instance",
     "capability": "service_validation", "base_url": "http://...",
     "mode": "enrichment", "required": false}
  ]
}
```

Field rules (validated by `personal-world framework validate`):

- `capability` must be a declared capability — providers never
  introduce new capabilities through config.
- `mode` is `native`, `enrichment` (default), or `replacement`.
- `required: true` needs a `required_reason`; optional is the default.
- `name` must be unique across all connections.
- Never inline secret values: use env indirection (`token_env`,
  `api_key_env`) or `secret_ref`. Keys named `token`, `password`,
  `api_key` with literal values are rejected.

Unknown types are skipped (not fatal): a standalone deployment boots
with zero providers connected.

## 4. Prove substitution

If your capability is new, register a fake reference provider in
tests and show the registry serves the contract through either
(`tests/test_core.py::TestProviderSubstitution` is the template).

## Provider status vocabulary

`healthy` / `unhealthy` / `unknown` / `unavailable` — neutral words,
never traffic-light colors, in any rendered output.

## source_control contract (native git baseline)

`source_control` is a native-baseline capability: the core itself
gives it useful local meaning with **zero providers connected**
(framework Rule 2). The baseline is read-only local git:

- Implementation: `src/personal_world/source_control.py`, registered
  in `build_registry` as provider `native-git` with
  `ProviderMode.NATIVE`. It always ships; it is never a boot
  dependency and never required.
- Canonical shape (enrichment may add richness, never alter it):
  `discover_repositories(paths)` → `{path, name, is_repository}`;
  `repository_status(path)` → `{path, name, branch, revision, dirty,
  ahead, behind, remote, last_commit_date, last_commit_subject,
  error}`; `repository_history(path, limit)` → `[{revision, date,
  author, subject}]` newest-first.
- No-remote repos are valid local-only state: `ahead`, `behind`, and
  `remote` are `None` — that is not an error. Every git failure
  becomes a structured state (`error` field, empty history); the
  module never raises and never runs a shell (`git --no-pager -C
  <path>` argv lists only, 10s timeout per call).
- Configuration: repo paths live in the `source_control.search_paths`
  key of `config/connections.json` (a sibling of `connections`, not a
  provider entry). Absence or malformed config is the honest
  `not_configured` state, never a crash.
- Enrichment seam: a Gitea (or other forge) connection may enrich the
  capability with remote-side data — issues, PRs, sync state beyond
  the local clone. The seam stays; enrichment must not change the
  native canonical shape above, and removing the provider degrades
  the world back to this baseline (`on_last_provider_removed`:
  degrades to native baseline).
- Surfaces: `personal-world changes|history|sync-status` (--json for
  the stable envelope) and `GET /api/source-control/status`,
  `/api/source-control/history?repo=<name>` (same auth as every
  protected route).

## Design implementation handoff (for DESIGN-HANDOFF.md)

If you are writing design handoff documentation, keep it tool-neutral.
Suggested verbatim section:

> Personal World design semantics are core-owned and live in the
> repository: `design/tokens.json` (semantic tokens:
> `surface.canvas`, `text.primary`, `status.healthy`, `focus.ring`,
> `motion.reduced`), the `Accessibility` model (motion, contrast,
> text_scale, density, targets), and the dashboard HTML/CSS as the
> executable reference. Any design tool — Figma, Penpot, or
> code-first — derives from these artifacts; none is the canonical
> source. This document is a design implementation handoff: it must
> remain usable to brief another design tool without reconstructing
> the product from source code. Navigation and presentation are
> organized around World concepts and user tasks (Today / World /
> Journal / Settings), never third-party product names; provider
> deep links are secondary navigation. A Figma-specific section may
> exist within this handoff; Figma-as-architecture does not.