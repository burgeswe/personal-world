"""Public-safety gate: the tracked default configuration of this
intentionally public repository must not carry operator deployment
endpoints. Private addresses, private hostnames, and this project's
real deployment topology belong in a private runtime config directory
(see docs/OPERATIONS.md), never in the shipped default.

RFC 5737/2606 documentation ranges and example.invalid hosts are
allowed everywhere (docs, tests, example files).
"""

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
TRACKED_CONFIG = REPO_ROOT / "config" / "connections.json"
EXAMPLE_CONFIG = REPO_ROOT / "config" / "connections.example.json"

# RFC1918 + link-local ranges for the private halves only; public
# documentation ranges (RFC 5737: 192.0.2.0/24, 198.51.100.0/24,
# 203.0.113.0/24) are deliberately NOT matched. Loopback (127.0.0.1)
# is allowed: it is the documented local-dev binding, not topology.
PRIVATE_IP_PARTS = (
    "192.168.",
    "10.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
    "169.254.",
    "localhost",
)

# Real-world deployment hostnames discovered in the original exposure.
# Kept as an explicit regression list: a future edit that re-adds one
# of these strings fails CI with a name, not a mystery.
FORBIDDEN_HOSTS = (
    "example.invalid",
)


def _forbidden_strings() -> tuple[str, ...]:
    return PRIVATE_IP_PARTS + FORBIDDEN_HOSTS


def _assert_clean(payload: dict, source: Path) -> None:
    blob = json.dumps(payload)
    for marker in _forbidden_strings():
        assert marker not in blob, (
            f"{source.name} carries private deployment marker "
            f"'{marker}' -- move real endpoints to a private runtime "
            f"config directory, not the tracked default"
        )


def test_tracked_connections_json_is_public_safe():
    """The shipped default config must be a zero-provider baseline."""
    payload = json.loads(TRACKED_CONFIG.read_text())
    assert payload.get("connections") == [], (
        "tracked config/connections.json must ship zero providers; "
        "real endpoints live in a private runtime config"
    )
    _assert_clean(payload, TRACKED_CONFIG)


def test_example_config_stays_documentation_safe():
    """The example may show the shape of wiring but only with
    documentation-reserved hosts (example.invalid)."""
    payload = json.loads(EXAMPLE_CONFIG.read_text())
    blob = json.dumps(payload)
    for marker in PRIVATE_IP_PARTS + FORBIDDEN_HOSTS:
        assert marker not in blob, (
            f"connections.example.json must use example.invalid hosts, "
            f"found '{marker}'"
        )


@pytest.mark.parametrize(
    "path",
    [
        REPO_ROOT / "config" / "connections.json",
        REPO_ROOT / "config" / "connections.example.json",
        REPO_ROOT / "env.example",
        REPO_ROOT / "compose.yaml",
    ],
    ids=["tracked", "example", "env-example", "compose"],
)
def test_shipped_files_carry_no_private_endpoints(path):
    """Any file a stranger's clone bootstraps from must be free of
    operator topology."""
    assert path.exists(), f"{path.name} missing"
    text = path.read_text()
    for marker in _forbidden_strings():
        assert marker not in text, (
            f"{path.name} carries private deployment marker '{marker}'"
        )