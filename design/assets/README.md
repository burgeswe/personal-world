# Personal World — Design Assets

Visual reference files for the Personal World companion character system and UI.

## Production Icon System

The [Personal World icon system](icons/README.md) contains 72 deterministic SVG assets, a Figma import library, application sprite, semantic manifest, and rendered QA previews. Interface glyphs use `currentColor`; five compact companion identity marks point back to the canonical source rigs below.

## Mermaid Companion (the operator's Theme)

| File | Description |
|---|---|
| `mermaid-source-rig-v2.svg` | **Primary deliverable** — polished, animation-ready SVG with 53+ named layer groups, the operator palette colors, and face variants (eyes-closed, mouth-neutral) for LottieFiles rigging |
| `MERMAID_RIG_CHANGES.md` | Detailed change notes from the art direction pass |
| `mermaid-idle.svg` | Earlier vector mermaid attempt (superseded by v2) |

## Companion System

The mermaid is the first of several companion characters:
- **the operator's Mermaid** — pastel kawaii, pink/lavender/mint/teal (✅ complete)
- **Little Helper** — cute robot with heart screen (pending final files)
- **VEFR Norse Squirrel** — squirrel with book tree (pending final files)
- **Tacos & the Morning Paper** — food truck companion (pending final files)

See `../COMPANION_INTEGRATION.md` for the full placement map and architecture.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| Ink Line | `#5A2D35` | All strokes |
| Pastel Pink | `#F8C5E8` | Hair, shells, cheeks |
| Lavender | `#E3D5F7` | Back hair |
| Soft Blue | `#BFD8FE` | Hair accent, shells |
| Mint Pastel | `#A7F3D0` | Hair accent, fins |
| Pale Gold | `#F6F0BA` | Sparkle |
| Mascot Teal | `#72B1B1` | Tail, bubbles |
| Skin | `#FFF0E4` | Face, torso, arms |

## Accessibility Constraints

All companion animations must follow migraine-safety rules:
- No flashing or strobing
- No rotation
- Max 300ms transitions
- Max 2px idle drift
- `prefers-reduced-motion` → static only
