"""Framework conformance validator.

Encodes the architectural invariants from docs/NATIVE-BASELINE-AND-
ENRICHMENT.md as executable checks so they cannot silently regress:

- capabilities are core-owned; providers implement or enrich them
- every connection references a declared capability
- provider IDs are unique per capability
- provider modes are from the closed vocabulary
- required providers are explicit, justified, and rare
- no inline secret material in connection config (env indirection only)
- core compose has no provider boot dependencies
- shareable exports carry capability intent and replaceable provider
  choice, never secret-bearing provider fields

The registry already fails closed at runtime; this module catches the
architecture-level violations that runtime cannot see.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .model import ProviderMode

SECRET_KEY_RE = re.compile(
    r"(?i)(password|passwd|secret|token|api[_-]?key|credential|private[_-]?key)$"
)
ALLOWED_REF_KEYS = {
    "token_env", "api_key_env", "secret_ref", "password_env", "env",
}
# Compose dependency keys that, when pointing at a provider service,
# would make that provider a core boot dependency.
COMPOSE_DEP_KEYS = ("depends_on", "links", "volumes_from", "network_mode")

STANDARD_CAPABILITIES = (
    "source_control", "deployment", "secrets", "calendar", "discovery",
    "settings_validation", "service_validation", "update_discovery",
    "memory", "journal", "reasoning", "notifications", "scheduler",
)


@dataclass
class Violation:
    rule: str
    detail: str

    def __str__(self) -> str:  # pragma: no cover -- display only
        return f"[{self.rule}] {self.detail}"


@dataclass
class ValidationResult:
    ok: bool = True
    violations: list[Violation] = field(default_factory=list)

    def add(self, rule: str, detail: str) -> None:
        self.ok = False
        self.violations.append(Violation(rule=rule, detail=detail))


def _scan_secretish(value, path: str, out: ValidationResult) -> None:
    """Recursively reject inline secret material and non-symbolic
    secret references in provider config."""
    if isinstance(value, dict):
        for k, v in value.items():
            key_path = f"{path}.{k}"
            if SECRET_KEY_RE.search(str(k)) and k not in ALLOWED_REF_KEYS:
                out.add(
                    "secret-rule",
                    f"connection field '{key_path}' looks like inline "
                    "secret material; use env indirection "
                    "(e.g. token_env: GITHUB_TOKEN) or secret_ref",
                )
                continue
            _scan_secretish(v, key_path, out)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _scan_secretish(v, f"{path}[{i}]", out)


def validate_connections(
    connections: dict, known_capabilities: set[str]
) -> ValidationResult:
    """Validate a parsed connections.json payload."""
    out = ValidationResult()
    conns = connections.get("connections", [])
    if not isinstance(conns, list):
        out.add("provider-registry", "connections must be a list")
        return out
    seen: dict[str, int] = {}
    for idx, conn in enumerate(conns):
        if not isinstance(conn, dict):
            out.add("provider-registry", f"connection #{idx} is not an object")
            continue
        ptype = conn.get("type")
        name = conn.get("name")
        capability = conn.get("capability")
        label = name or f"#{idx}"
        if not all([ptype, name, capability]):
            out.add(
                "provider-registry",
                f"connection '{label}' missing type/name/capability",
            )
            continue
        if capability not in known_capabilities:
            out.add(
                "capability-ownership",
                f"provider '{name}' claims capability '{capability}' "
                "which is not a declared capability",
            )
        seen[name] = seen.get(name, 0) + 1
        mode = conn.get("mode", ProviderMode.ENRICHMENT.value)
        if mode not in {m.value for m in ProviderMode}:
            out.add(
                "provider-mode",
                f"provider '{name}' has unsupported mode '{mode}'",
            )
        required = conn.get("required", False)
        if required and not conn.get("required_reason"):
            out.add(
                "optional-default",
                f"provider '{name}' is marked required without a "
                "required_reason; required is an explicit exception",
            )
        _scan_secretish(conn, f"connections[{label}]", out)
    for name, count in seen.items():
        if count > 1:
            out.add(
                "provider-registry",
                f"duplicate provider id '{name}' ({count} connections)",
            )
    return out


def validate_compose_file(path: Path, provider_service_names: set[str]) -> ValidationResult:
    """Reject core compose boot dependencies on provider services
    (framework Rule 6: providers cannot quietly become required)."""
    out = ValidationResult()
    if not path.exists():
        return out
    compose = yaml.safe_load(path.read_text()) or {}
    for svc_name, svc in compose.get("services", {}).items():
        if svc_name in provider_service_names:
            # Provider-side services may depend on each other or the
            # core; the constraint under test is the core's freedom.
            continue
        for dep_key in COMPOSE_DEP_KEYS:
            deps = svc.get(dep_key)
            if deps is None:
                continue
            targets = list(deps.keys()) if isinstance(deps, dict) else list(deps)
            for target in targets:
                if target in provider_service_names:
                    out.add(
                        "compose-additive",
                        f"core service '{svc_name}' has {dep_key} on "
                        f"provider service '{target}'; optional providers "
                        "must be additive, not boot dependencies",
                    )
    return out


def validate_settings_export(export: dict) -> ValidationResult:
    """The shareable blueprint must express capability intent plus
    replaceable provider choice (framework export rule)."""
    out = ValidationResult()
    for cap in export.get("capabilities", []):
        for p in cap.get("providers", []):
            for forbidden in ("config", "requires_secrets"):
                if forbidden in p:
                    out.add(
                        "export-portability",
                        f"settings-export provider entry for "
                        f"'{cap.get('key')}' includes forbidden field "
                        f"'{forbidden}'",
                    )
    return out