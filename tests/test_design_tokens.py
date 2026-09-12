"""P1 T3: approved focus-ring design-truth correction (A11y §2.4).

Regression test added 2026-09-11 (UI-convergence session): the
original assertions here checked for the literal unresolved token
reference string "accent.primary" rather than a real color value —
i.e. this test was passing while `--pw-focus-ring` in the generated
CSS was invalid (`outline: 2px solid accent.primary, offset 2px`,
which browsers silently drop as invalid, since `accent.primary` is
not a CSS color and the shorthand doesn't take a comma or an
"offset" component). That left every keyboard focus indicator in the
app invisible despite this test showing green. `focus.ring` must be a
value the `outline` CSS shorthand actually accepts.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

_OUTLINE_SHORTHAND = re.compile(
    r"^2px solid (#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})$"
)


def test_focus_ring_matches_accessibility_contract():
    repo_root = Path(__file__).parent.parent
    tokens = json.loads((repo_root / "design" / "tokens.json").read_text())
    focus = tokens["focus"]
    ring = focus["focus.ring"]
    ring_hc = focus["focus.ring_high_contrast"]

    # Must be a real, resolved CSS `outline` shorthand value — not a
    # dotted token reference, and not `outline-offset` folded in (that
    # is a separate property, applied independently in index.css).
    assert _OUTLINE_SHORTHAND.match(ring), (
        f"focus.ring must be a literal '2px solid #rrggbb' outline value, "
        f"got {ring!r} (unresolved token references or extra components "
        f"like ', offset 2px' make the CSS `outline` declaration invalid "
        f"and browsers silently drop it — see 2026-09-11 provenance note "
        f"above and design/tokens.json)"
    )
    assert _OUTLINE_SHORTHAND.match(ring_hc), (
        f"focus.ring_high_contrast must be a literal outline value, got {ring_hc!r}"
    )

    # A11y §2.4: comfortable mode is teal (#72b1b1); high contrast is white.
    assert ring == "2px solid #72b1b1"
    assert ring_hc == "2px solid #FFFFFF"

    # The resolved color must match design/tokens.json's own
    # `color.accent.primary` — the two must never drift apart.
    assert tokens["color"]["accent.primary"] == "#72b1b1"