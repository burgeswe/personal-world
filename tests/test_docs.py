"""Documentation validation: low-noise checks that keep the docs index
honest. Internal Markdown links must resolve, and the canonical
navigation files must exist. External links are deliberately NOT
checked — other people's websites are not this repository's CI
concern.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]

CANONICAL_FILES = (
    "README.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "AGENTS.md",
    "docs/INDEX.md",
    "docs/ARCHITECTURE.md",
    "docs/NATIVE-BASELINE-AND-ENRICHMENT.md",
    "docs/OPERATIONS.md",
    "docs/PROVIDERS.md",
    "design/tokens.json",
    "design/COMPANION_INTEGRATION.md",
)

EXCLUDED_DIRS = (".venv", "node_modules", ".git", "data", "config.local")


def _markdown_files() -> list[Path]:
    out = []
    for f in REPO_ROOT.rglob("*.md"):
        s = str(f)
        if any(d in s for d in EXCLUDED_DIRS):
            continue
        out.append(f)
    return out


def test_canonical_files_exist():
    for rel in CANONICAL_FILES:
        assert (REPO_ROOT / rel).exists(), f"canonical file missing: {rel}"


@pytest.mark.parametrize("md", _markdown_files(), ids=lambda p: str(p))
def test_internal_links_resolve(md: Path):
    text = md.read_text(errors="ignore")
    missing = []
    for m in re.finditer(r"\]\(([^)#\s]+?)(#[^)]*)?\)", text):
        target = m.group(1).strip()
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        if not (md.parent / target).resolve().exists():
            missing.append(target)
    assert not missing, f"{md}: broken internal links: {missing}"