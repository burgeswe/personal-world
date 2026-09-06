# Writing a Provider

A provider maps one capability to one real system, without modifying
that system. The core never requires any specific provider.

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
     "capability": "service_validation", "base_url": "http://..."}
  ]
}
```

Unknown types are skipped (not fatal): a standalone deployment boots
with zero providers connected.

## 4. Prove substitution

If your capability is new, register a fake reference provider in
tests and show the registry serves the contract through either
(`tests/test_core.py::TestProviderSubstitution` is the template).

## Provider status vocabulary

`healthy` / `unhealthy` / `unknown` / `unavailable` — neutral words,
never traffic-light colors, in any rendered output.