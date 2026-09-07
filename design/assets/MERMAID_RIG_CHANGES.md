# Mermaid Source Rig v2 — Change Notes

**Source:** ChatGPT's `mermaid-source-rig.svg`  
**Output:** `mermaid-source-rig-v2.svg`  
**Date:** 2026-09-07  
**Author:** Figma Agent (art direction pass)

## What changed

### Color palette → Rylee theme
All fills and strokes remapped to the exact Rylee Mermaid palette:

| Token | Hex | Used on |
|---|---|---|
| Ink Line | `#5A2D35` | All strokes (was `#603D49`) |
| Lavender | `#E3D5F7` | hair-back-base (was `#DFCEF1`) |
| Soft Blue | `#BFD8FE` | hair-back-blue, shell-left, shell-right (was `#BED5F5`, `#D9C4EF`, `#C3D5F3`) |
| Mint Pastel | `#A7F3D0` | hair-back-mint, fin-left-shape, side-lock-mint (was `#ACEBD5`) |
| Pastel Pink | `#F8C5E8` | fringe-pink, fringe-sweep, shell-center, cheeks (was `#F4C6E9`, `#F5C8E7`, `#F7C8E4`) |
| Mascot Teal | `#72B1B1` | tail-shape, bubble strokes (was `#78B5B6`, `#82BABB`) |
| Pale Gold | `#F6F0BA` | sparkle fill (unchanged) |
| Skin | `#FFF0E4` | head-skin, torso-skin, arms (unchanged) |

### Animation face variants added
- **`eyes-closed`** — Curved lash lines with eyelash detail strokes, positioned to overlay `eyes-open`. Set to `display="none"` in SVG.
- **`mouth-neutral`** — Horizontal straight line (stroke-linecap round), same position as smile mouth. Set to `display="none"` in SVG.

### Layer structure preserved
All 53+ named groups from ChatGPT's original rig are intact. The full hierarchy:
```
mermaid
├── hair-back (hair-back-base, hair-back-blue, hair-back-mint)
├── body-torso (torso-skin)
├── tail-assembly
│   ├── tail-fin-left (fin-left-shape, fin-left-detail)
│   ├── tail-fin-right (fin-right-shape, fin-right-detail)
│   └── tail (tail-shape, tail-highlight, outline-details)
├── arm-left (arm-left-skin, hand-left-detail)
├── arm-right (arm-right-skin, hand-right-detail)
├── shell-top (shell-left, shell-right, shell-ridges, shell-center)
├── face-head
│   ├── head-skin
│   └── face-details
│       ├── eyes-open (4 paths: pupils + highlights)
│       ├── eyes-closed [display=none] (eye-closed, eye-closed_2)
│       ├── cheeks (2 ellipses)
│       ├── nose
│       ├── mouth (smile curve)
│       └── mouth-neutral [display=none] (straight line)
├── hair-front (fringe-pink, fringe-sweep, side-lock-mint, hair-strand-detail)
└── bubbles-sparkles (bubble-large, bubble-small, sparkle)
```

### Export cleanup
- Removed Figma's `<rect fill="#1E1E1E"/>` background
- Added `<title>` and `<desc>` accessibility metadata
- Added `role="img"` and `aria-labelledby`

## For LottieFiles
To toggle face states in the animation rig:
- **Smile → neutral:** Hide `mouth`, show `mouth-neutral`
- **Eyes open → closed:** Hide `eyes-open`, show `eyes-closed`
- All switching is `display` toggling — no path morphing needed for basic states

## What was NOT changed
- Path geometry — all shapes are ChatGPT's original vectors
- Layer order / z-stacking
- Stroke widths and line caps
- Canvas size (512×512)
- No animation was added (per brief: stop after polished vector)
