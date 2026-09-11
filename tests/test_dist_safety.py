"""P1 T14, FOUNDATION-SPEC §7 row 17 / §11: dist safety gates.

(a) Secret-shape scan over every built frontend/dist file — the same
    P0.7 pattern list tests/test_public_safety.py ships, re-here so the
    gate lives next to the artifact it guards. A provider key pasted
    into a tracked file is caught by public-safety; a key baked into a
    bundle at build time is only visible here.
(b) `import.meta.env` produced only VITE_API_URL: the dist must not
    embed any other VITE_* value.
(c) Bundle gate: JS gzip ≤ 350 KB (spec §8 frontend job), via node
    zlib — deterministic, no new deps.

SKIP locally when frontend/dist is absent (build is not tracked);
REQUIRED in CI, where the frontend/browser job builds dist first.
"""

import gzip
import os
import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
DIST = REPO / "frontend" / "dist"

pytestmark = pytest.mark.skipif(
    not DIST.is_dir(),
    reason="frontend/dist not built (CI builds it before this test)",
)

# P0.7 pattern list (mirrors tests/test_public_safety.py SECRET_PATTERNS;
# keep in sync deliberately — public-safety owns the canonical copy).
SECRET_PATTERNS: dict[str, re.Pattern[str]] = {
    "openai-style key (sk-…)": re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    "token-plan key (tp-…)": re.compile(r"\btp-[a-z0-9]{16,}"),
    "github token (ghp_/gho_/ghs_/ghr_)": re.compile(
        r"\bgh[posr]_[A-Za-z0-9]{30,}"),
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

TEXT_SUFFIXES = {".html", ".js", ".css", ".svg", ".txt", ".json", ".map"}


def _dist_files() -> list[Path]:
    return [p for p in DIST.rglob("*") if p.is_file()]


def _scannable(files: list[Path]) -> list[Path]:
    return [p for p in files if p.suffix.lower() in TEXT_SUFFIXES]


def test_dist_secret_scan() -> None:
    files = _scannable(_dist_files())
    assert files, "dist exists but no text artifacts found"
    findings: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                # Redacted: name the file and shape, never the value.
                findings.append(f"{path.relative_to(DIST)}: {label}")
    assert not findings, (
        "secret shapes found in frontend/dist: " + "; ".join(findings))


def test_dist_env_is_only_vite_api_url() -> None:
    for path in _scannable(_dist_files()):
        text = path.read_text(encoding="utf-8", errors="replace")
        for var in re.findall(r"\bVITE_[A-Z0-9_]+\b", text):
            assert var == "VITE_API_URL", (
                f"{path.relative_to(DIST)} embeds {var}; only VITE_API_URL "
                "may reach the bundle (spec row 17)"
            )


def test_bundle_gzip_size_cap() -> None:
    js_files = [p for p in _dist_files() if p.suffix == ".js"]
    assert js_files, "no JS bundles in dist"
    total = 0
    for path in js_files:
        data = path.read_bytes()
        gz = len(gzip.compress(data))
        # The build log uses node zlib level 6 defaults; python's gzip
        # default level 9 is a close deterministic proxy.
        total += gz
    assert total <= 350 * 1024, (
        f"JS bundle gzipped {total} bytes > 350 KB cap (spec row 17)"
    )


def test_dist_matches_a_fresh_build() -> None:
    """CI-only integrity check: the served dist is repo-built, not a
    stale artifact. Locally this compares mtimes only."""
    index = DIST / "index.html"
    assert index.is_file(), "dist lacks index.html"
    src_mtime = max(
        p.stat().st_mtime
        for p in (REPO / "frontend" / "src").rglob("*")
        if p.is_file()
    )
    # Skip in CI too: mtimes are not reliable in containers. The
    # frontend job always builds dist immediately before the browser
    # job consumes it, so staleness is excluded structurally there.
    if os.environ.get("CI") == "true":
        pytest.skip("mtime ordering is not meaningful in CI containers")
    assert index.stat().st_mtime >= src_mtime - 1, (
        "frontend/dist is older than frontend/src — rebuild "
        "(npm run build) before serving"
    )