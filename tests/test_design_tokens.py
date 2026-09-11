"""P1 T3: approved focus-ring design-truth correction (A11y §2.4)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_focus_ring_matches_accessibility_contract():
    repo_root = Path(__file__).parent.parent
    tokens = json.loads((repo_root / "design" / "tokens.json").read_text())
    focus = tokens["focus"]
    assert focus["focus.ring"].startswith("2px solid accent.primary")
    assert focus["focus.ring_high_contrast"].startswith("2px solid #FFFFFF")