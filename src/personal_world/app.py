"""App wiring: build a World + Registry + Journal from a config dir.

V0 persistence: the world is a JSON file (facts/intents/policies/lore/
capabilities/providers/packs/accessibility); the journal is NDJSON.
Both live under PW_DATA_DIR (volume-backed in compose).
"""

import json
from pathlib import Path
from typing import Any

from .model import (
    Accessibility,
    Capability,
    Fact,
    Intent,
    Lore,
    Pack,
    Policy,
    Provider,
    ProviderMode,
    SCHEMA_VERSION,
)
from .chat import build_chat_provider
from .providers.adapters import (
    CandyDispenser,
    FakeSourceControl,
    Gitea,
    HttpStatus,
    LangGraphMemory,
)
from .providers.registry import Contract, Registry, StatusContract
from .source_control import NativeGit, configured_search_paths
from .world import World


# key, description, native_baseline (framework Rule 2: does the core
# itself give this capability useful local meaning with zero providers?)
STANDARD_CAPABILITIES: list[tuple[str, str, bool]] = [
    ("source_control", "Read repositories, issues, pull requests", True),
    ("deployment", "Deploy or schedule services", False),
    ("secrets", "Broker secret material to consumers", False),
    ("calendar", "Observe calendar events", False),
    ("discovery", "Discover content matching interests", False),
    ("settings_validation", "Validate settings against intent", True),
    ("service_validation", "Validate service health", False),
    ("update_discovery", "Discover available updates", False),
    ("memory", "Search long-term memory", False),
    ("journal", "Read structured history", True),
    ("reasoning", "Optional AI interpretation", False),
    ("notifications", "Send notifications", False),
    ("scheduler", "Run tasks on a schedule", False),
]


def define_standard_capabilities(registry: Registry) -> None:
    for key, doc, _native in STANDARD_CAPABILITIES:
        registry.define_capability(key, StatusContract)


def native_baseline_capabilities() -> set[str]:
    """Capability keys whose native baseline ships with the core
    (framework Rule 2). The manifest reads this; the registry's
    native_baseline answer is 'core provides meaning without any
    provider', which is exactly this set."""
    return {key for key, _doc, native in STANDARD_CAPABILITIES if native}


def save_world(world: World, path: Path) -> None:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "facts": {k: f.model_dump(mode="json") for k, f in world.facts.items()},
        "intents": {k: i.model_dump(mode="json") for k, i in world.intents.items()},
        "policies": {k: p.model_dump(mode="json") for k, p in world.policies.items()},
        "lore": {k: l.model_dump(mode="json") for k, l in world.lore.items()},
        "capabilities": {
            k: c.model_dump(mode="json") for k, c in world.capabilities.items()
        },
        "providers": {
            k: [p.model_dump(mode="json") for p in v]
            for k, v in world.providers.items()
        },
        "packs": {k: p.model_dump(mode="json") for k, p in world.packs.items()},
        "accessibility": world.accessibility,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2))


def load_world(path: Path) -> World:
    world = World()
    if not path.exists():
        return world
    payload: dict[str, Any] = json.loads(path.read_text())
    version = payload.get("schema_version")
    if version is not None and version != SCHEMA_VERSION:
        raise ValueError(
            f"world.json schema_version {version!r} != {SCHEMA_VERSION!r}; "
            "explicit migration required (see docs/NATIVE-BASELINE-AND-"
            "ENRICHMENT.md, Initialization)"
        )
    for k, v in payload.get("facts", {}).items():
        world.facts[k] = Fact.model_validate(v)
    for k, v in payload.get("intents", {}).items():
        world.intents[k] = Intent.model_validate(v)
    for k, v in payload.get("policies", {}).items():
        world.policies[k] = Policy.model_validate(v)
    for k, v in payload.get("lore", {}).items():
        world.lore[k] = Lore.model_validate(v)
    for k, v in payload.get("capabilities", {}).items():
        world.capabilities[k] = Capability.model_validate(v)
    for k, items in payload.get("providers", {}).items():
        world.providers[k] = [Provider.model_validate(v) for v in items]
    for k, v in payload.get("packs", {}).items():
        world.packs[k] = Pack.model_validate(v)
    if payload.get("accessibility"):
        world.accessibility = payload["accessibility"]
    return world


def build_registry(world: World, registry: Registry, config_dir: Path) -> Registry:
    """Wire providers from config/connections.json. Unknown provider
    types are skipped with a warning; the core still boots. The
    source_control native baseline is registered when no provider for
    the capability is configured (zero-provider boot); a configured
    enrichment provider takes the active slot and removal degrades back
    to this baseline on the next boot."""
    define_standard_capabilities(registry)
    registry.native_baselines = native_baseline_capabilities()

    conn_path = config_dir / "connections.json"
    conns: dict[str, Any] = {}
    if conn_path.exists():
        try:
            conns = json.loads(conn_path.read_text())
        except json.JSONDecodeError:
            conns = {}
    connections = [
        c for c in conns.get("connections", []) if isinstance(c, dict)
    ]

    # Native baseline (see comment above)
    if not any(c.get("capability") == "source_control" for c in connections):
        try:
            git_impl = NativeGit(configured_search_paths(config_dir))
            registry.register(
                "source_control", "native-git", git_impl,
                health_check=git_impl.git_available,
                writes="none",
                mode=ProviderMode.NATIVE,
                required=False,
            )
        except Exception:  # native baseline must never block boot
            registry.native_baselines.discard("source_control")

    for conn in connections:
        ptype = conn.get("type")
        name = conn.get("name")
        capability = conn.get("capability")
        if not all([ptype, name, capability]):
            continue
        mode = ProviderMode(conn.get("mode", ProviderMode.ENRICHMENT.value))
        required = bool(conn.get("required", False))
        if ptype == "http_status":
            url = conn.get("url")
            if url:
                impl = HttpStatus(name, url, conn.get("expected", 200))
                registry.register(
                    capability, name, impl,
                    health_check=impl.probe,
                    writes="none",
                    mode=mode,
                    required=required,
                )
        elif ptype == "gitea":
            base = conn.get("base_url")
            if base:
                impl = Gitea(base, conn.get("token_env", "GITEA_TOKEN"))
                registry.register(
                    capability, name, impl,
                    health_check=lambda: impl.observe().ok,
                    writes="none",
                    mode=mode,
                    required=required,
                )
                # Gitea is enrichment: it adds remote-side richness on
                # top of the native git baseline; the native canonical
                # shape (source_control.py) is unchanged by it.
        elif ptype == "langgraph":
            base = conn.get("base_url")
            if base:
                impl = LangGraphMemory(base, conn.get("api_key_env"))
                registry.register(
                    capability, name, impl,
                    health_check=impl.health,
                    writes="none",
                    mode=mode,
                    required=required,
                )
        elif ptype in ("ollama", "openai_compat"):
            # Chat/reasoning providers use the same fail-closed registry:
            # an unreachable local model is 'unavailable', never a crash.
            built = build_chat_provider(conn)
            if built is not None:
                cname, impl = built
                registry.register(
                    capability or "reasoning", cname, impl,
                    health_check=lambda i=impl: i.observe().ok,
                    writes="none",
                    mode=mode,
                    required=required,
                )
        elif ptype == "fake_source_control":
            # Reference provider for substitution proofs (framework E):
            # same SourceControlContract, deterministic, no external
            # system. Never a production dependency.
            impl = FakeSourceControl(conn.get("version", "fake-1.0"))
            registry.register(
                capability, name, impl,
                health_check=lambda: True,
                writes="none",
                mode=mode,
                required=required,
            )
        elif ptype == "candy":
            base = conn.get("base_url")
            if base:
                impl = CandyDispenser(base)
                registry.register(
                    capability, name, impl,
                    health_check=lambda: impl.health().ok,
                    writes="none",
                    mode=mode,
                    required=required,
                )
        # unknown types: skipped, not fatal -- standalone deployments
        # boot with zero providers
    # Chat/reasoning native baseline: absent a configured provider the
    # capability is honestly not_configured (zero-AI boot is supported).
    if not any(
        c.get("capability") == "reasoning" for c in connections
    ):
        registry.define_capability("reasoning", StatusContract)

    for cap in world.capabilities.values():
        if cap.key not in registry._contracts:
            registry.define_capability(cap.key, StatusContract)
    return registry