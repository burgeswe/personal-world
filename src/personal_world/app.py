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
)
from .providers.adapters import Gitea, HttpStatus
from .providers.registry import Contract, Registry, StatusContract
from .world import World


def define_standard_capabilities(registry: Registry) -> None:
    for key, doc in [
        ("source_control", "Read repositories, issues, pull requests"),
        ("deployment", "Deploy or schedule services"),
        ("secrets", "Broker secret material to consumers"),
        ("calendar", "Observe calendar events"),
        ("discovery", "Discover content matching interests"),
        ("settings_validation", "Validate settings against intent"),
        ("service_validation", "Validate service health"),
        ("update_discovery", "Discover available updates"),
        ("memory", "Search long-term memory"),
        ("journal", "Read structured history"),
        ("reasoning", "Optional AI interpretation"),
        ("notifications", "Send notifications"),
        ("scheduler", "Run tasks on a schedule"),
    ]:
        registry.define_capability(key, StatusContract)


def save_world(world: World, path: Path) -> None:
    payload = {
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
    types are skipped with a warning; the core still boots."""
    define_standard_capabilities(registry)
    conn_path = config_dir / "connections.json"
    if not conn_path.exists():
        return registry
    conns = json.loads(conn_path.read_text())
    for conn in conns.get("connections", []):
        ptype = conn.get("type")
        name = conn.get("name")
        capability = conn.get("capability")
        if not all([ptype, name, capability]):
            continue
        if ptype == "http_status":
            url = conn.get("url")
            if url:
                impl = HttpStatus(name, url, conn.get("expected", 200))
                registry.register(
                    capability, name, impl,
                    health_check=impl.probe,
                    writes="none",
                )
        elif ptype == "gitea":
            base = conn.get("base_url")
            if base:
                impl = Gitea(base, conn.get("token_env", "GITEA_TOKEN"))
                registry.register(
                    capability, name, impl,
                    health_check=lambda: impl.observe().ok,
                    writes="none",
                )
        # unknown types: skipped, not fatal -- standalone deployments
        # boot with zero providers
    for cap in world.capabilities.values():
        if cap.key not in registry._contracts:
            registry.define_capability(cap.key, StatusContract)
    return registry