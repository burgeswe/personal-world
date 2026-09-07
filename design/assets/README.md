# Personal World — Design Assets

Visual reference files for the Personal World companion character system and UI.

## Production Icon System

The [Personal World icon system](icons/README.md) contains 72 deterministic SVG assets, a Figma import library, application sprite, semantic manifest, and rendered QA previews. Interface glyphs use `currentColor`; five compact companion identity marks point back to the canonical source rigs below.

## Mermaid Companion (Rylee's Theme)

| File | Description |
|---|---|
| [mermaid-companion-master.lottie](mermaid-companion-master.lottie) | Uploaded animation master: 512 × 512, 30 fps, 498 frames; see details below |
| [mermaid-source-rig-v2.svg](mermaid-source-rig-v2.svg) | **Canonical source rig** — polished, animation-ready SVG with 53+ named layer groups, Rylee palette colors, and face variants (eyes-closed, mouth-neutral) for LottieFiles rigging |
| [MERMAID_RIG_CHANGES.md](MERMAID_RIG_CHANGES.md) | Detailed change notes from the art direction pass |
| [mermaid-idle.svg](mermaid-idle.svg) | Earlier vector mermaid attempt (superseded by v2) |

## Companion System

The mermaid is the first of several companion characters:
- **Rylee's Mermaid** — pastel kawaii, pink/lavender/mint/teal (✅ complete)
- **Little Helper** — cute robot with heart screen ([source collection available](companions/README.md))
- **VEFR Norse Squirrel** — squirrel with book tree ([source collection available](companions/README.md))
- **Tacos & the Morning Paper** — food truck companion ([source collection available](companions/README.md))

See [Companion integration](../COMPANION_INTEGRATION.md) for the full placement map and architecture.

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

## Uploaded Mermaid master

The `.lottie` is an intentional ZIP-based animation asset, not a stray binary.
It contains a manifest, one animation JSON, and one bundled WebP image. All asset
references are internal. Keep the file byte-for-byte unless animation work is
explicitly requested. The source rig and [16-part import adapters](mermaid-lottie-parts/README.md)
remain useful editable source; they are not upload debris.

| Marker | Start frame | Duration in frames |
|---|---:|---:|
| idle | 0 | 90 |
| hello | 96 | 45 |
| listening | 147 | 75 |
| thinking | 228 | 90 |
| celebrate | 324 | 45 |
| sleep | 375 | 120 |

Archive integrity, JSON structure, markers and internal references were checked.
Small-size playback at 32/48/64 px on light and dark backgrounds, including
reduced-motion static poses, remains an explicit renderer QA gate. The master
is not automatically integrated into the application by being present here.
