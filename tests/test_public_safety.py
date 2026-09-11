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
# (Literal redacted post-rewrite: the original operator hostname lives
# only in private runtime configs now; the RFC2606 .invalid TLD is
# reserved for documentation and can never be a real deployment host.)
FORBIDDEN_HOSTS = (
    ".hulganfamily.duckdns.org",
    "hulganfamily",
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
    count = len(payload.get("connections") or [])
    # never `== []` on the payload: a failing assert would print the dict,
    # i.e. echo whatever secret was pasted in
    assert count == 0, (
        f"tracked config/connections.json must ship zero providers "
        f"(found {count}); real endpoints live in a private runtime config"
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

# ---------------------------------------------------------------------------
# Secret-shape scan over every tracked text file (P0.7).
#
# The endpoint checks above catch topology. This catches *credential
# material*: a provider key pasted into a tracked JSON, a bearer token
# in a frontend env file, a private key block. It is shape-based and
# deliberately conservative — env-indirection forms (`api_key_env`,
# `token_env`, `secret_ref`) are the allowed way to reference secrets
# and never match. Findings are reported redacted: the test must never
# echo the very value it is guarding.
# ---------------------------------------------------------------------------

import re
import subprocess

SECRET_PATTERNS: dict[str, re.Pattern[str]] = {
    "openai-style key (sk-…)": re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    "token-plan key (tp-…)": re.compile(r"\btp-[a-z0-9]{16,}"),
    "github token (ghp_/gho_/ghs_/ghr_)": re.compile(r"\bgh[posr]_[A-Za-z0-9]{30,}"),
    "aws access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}"),
    "private key block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "inline api_key/token/password/secret value": re.compile(
        r"""["']?\b(api_key|apikey|token|password|passwd|secret|bearer)["']?\s*[:=]\s*["'][^"'\s$<>{}]{24,}["']""",
        re.IGNORECASE,
    ),
    "client-side token env (VITE_*TOKEN|SECRET|KEY)": re.compile(
        r"\bVITE_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD)\b"),
}

# Source/config/test/script/frontend code must not bake in a personal
# home directory. Docs may mention the pattern when describing it.
HOME_PATH = re.compile(r"(/home/[a-z][a-z0-9_\-]*/|/Users/[A-Za-z][A-Za-z0-9_\-]*/)")
HOME_PATH_SCOPES = ("src/", "config/", "tests/", "scripts/", "frontend/", "frontend-v2/")

TEXT_SUFFIXES = {".py", ".json", ".yaml", ".yml", ".toml", ".md", ".sh",
                 ".ts", ".tsx", ".js", ".html", ".css", ".txt", ".example",
                 ".cfg", ".ini", ".env"}
# Generated/asset files: hashes and base64 art, never credentials.
SKIP_PREFIXES = ("design/assets/", "design/screens/", "design/exports/",
                 "design/handoff/")
SKIP_NAMES = {"uv.lock", "package-lock.json"}
# A synthetic canary a test deliberately plants (to prove it cannot leak)
# is allowed only with this exact marker on the same line, so the
# exception is visible in review and grep-able.
ALLOW_MARKER = "pw-safety: synthetic"


def _tracked_text_files() -> list[Path]:
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=REPO_ROOT,
                             capture_output=True, check=True).stdout
        names = [n for n in out.decode().split("\0") if n]
    except Exception:  # no git (e.g. a tarball checkout): walk instead
        names = [str(p.relative_to(REPO_ROOT)) for p in REPO_ROOT.rglob("*")
                 if p.is_file() and ".git" not in p.parts
                 and "node_modules" not in p.parts and ".venv" not in p.parts]
    files = []
    for n in names:
        if n.startswith(SKIP_PREFIXES) or Path(n).name in SKIP_NAMES:
            continue
        p = Path(n)
        if p.suffix.lower() in TEXT_SUFFIXES or p.name.startswith(".env"):
            full = REPO_ROOT / p
            if full.is_file():
                files.append(p)
    return files


def _redact(match: str) -> str:
    return match[:4] + "…" + f"({len(match)} chars)"


def test_tracked_text_files_carry_no_secret_shaped_values():
    """No credential material in any tracked text file. Redacted report."""
    findings: list[str] = []
    for rel in _tracked_text_files():
        try:
            text = (REPO_ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        # this very file defines the patterns; skip its own pattern table
        if rel.as_posix() == "tests/test_public_safety.py":
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if ALLOW_MARKER in line:
                continue  # explicit, reviewable canary (tests only)
            for label, pat in SECRET_PATTERNS.items():
                m = pat.search(line)
                if m:
                    findings.append(f"{rel}:{lineno} [{label}] {_redact(m.group(0))}")
    assert not findings, (
        "secret-shaped values in tracked files (values redacted). Move them "
        "to private runtime config via env indirection (api_key_env / "
        "token_env / secret_ref) and rotate the exposed credential:\n  "
        + "\n  ".join(findings)
    )


def test_code_and_config_carry_no_personal_home_paths():
    """A hard-coded /home/<user>/ or /Users/<user>/ path is both a
    personal-data leak and a portability bug (PW_DATA_DIR / PW_CONFIG_DIR
    exist for this)."""
    findings: list[str] = []
    for rel in _tracked_text_files():
        posix = rel.as_posix()
        if not posix.startswith(HOME_PATH_SCOPES) or posix == "tests/test_public_safety.py":
            continue
        text = (REPO_ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if HOME_PATH.search(line):
                findings.append(f"{posix}:{lineno}")
    assert not findings, "personal home paths in code/config:\n  " + "\n  ".join(findings)


def test_tracked_connections_report_never_echoes_values():
    """Companion to test_tracked_connections_json_is_public_safe: if the
    tracked file ever gains a provider, the failure message names the
    entry, never dumps it (a dump would print the very key we caught)."""
    payload = json.loads(TRACKED_CONFIG.read_text())
    names = [f"{c.get('type', '?')}:{c.get('name') or c.get('id') or '?'}"
             for c in payload.get("connections", [])]
    assert names == [], (
        "tracked config/connections.json ships providers (names only shown): "
        + ", ".join(names)
    )


@pytest.mark.parametrize("sample,label", [
    ('"api_key": "' + "A" * 40 + '"', "inline api_key/token/password/secret value"),
    ("sk-" + "x" * 40, "openai-style key (sk-…)"),
    ("tp-" + "a1" * 12, "token-plan key (tp-…)"),
    ("ghp_" + "Z" * 36, "github token (ghp_/gho_/ghs_/ghr_)"),
    ("-----BEGIN OPENSSH PRIVATE KEY-----", "private key block"),
    ("VITE_AUTH_TOKEN=whatever", "client-side token env (VITE_*TOKEN|SECRET|KEY)"),
    ("AKIA" + "Q" * 16, "aws access key"),
])
def test_secret_scanner_detects_shapes(sample, label):
    """The scanner must actually fire on the shapes it claims to catch.
    Samples are built by concatenation so this file never contains a
    literal that looks like a credential."""
    assert SECRET_PATTERNS[label].search(sample), label


@pytest.mark.parametrize("sample", [
    '"api_key_env": "MY_PROVIDER_KEY"',
    '"token_env": "GITEA_TOKEN"',
    '"secret_ref": "vault://gitea-token"',
    'sha256:' + "f" * 64,
    '"password": "short"',
    "VITE_API_URL=/",
])
def test_secret_scanner_allows_indirection_and_hashes(sample):
    assert not any(p.search(sample) for p in SECRET_PATTERNS.values()), sample


def _walk_keys(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield f"{path}.{k}" if path else k, k
            yield from _walk_keys(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk_keys(v, f"{path}[{i}]")


INLINE_SECRET_KEYS = {"api_key", "apikey", "token", "password", "secret",
                      "client_secret", "access_token", "refresh_token"}


@pytest.mark.parametrize("rel", sorted(
    p.as_posix() for p in _tracked_text_files()
    if p.as_posix().startswith("config/") and p.suffix == ".json"
    and not p.name.endswith(".example.json")))
def test_tracked_non_example_config_is_zero_provider_and_secret_free(rel):
    """Ownership rule (completion plan C-1): tracked config/ holds only
    schemas, examples and zero-provider defaults. Personal values live in
    config/*.local.json, config.local/ or data/ — all gitignored."""
    payload = json.loads((REPO_ROOT / rel).read_text())
    assert not payload.get("connections"), f"{rel} ships providers"
    bad = [path for path, key in _walk_keys(payload)
           if key.lower() in INLINE_SECRET_KEYS]
    assert not bad, f"{rel} has inline secret keys at: {bad} (use *_env / *_ref)"
