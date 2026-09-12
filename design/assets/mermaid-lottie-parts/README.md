# Mermaid LottieFiles per-part import adapters

## Canonical source and purpose

Canonical artwork: **`design/assets/mermaid-source-rig-v2.svg` @ `10ff4d9`**, full source commit `10ff4d91ff953a584281705aa2c0899b8772e774`.

- [Pinned approved master](https://raw.githubusercontent.com/Rylee-Bee/personal-world/10ff4d91ff953a584281705aa2c0899b8772e774/design/assets/mermaid-source-rig-v2.svg)
- [Pinned change notes](https://raw.githubusercontent.com/Rylee-Bee/personal-world/10ff4d91ff953a584281705aa2c0899b8772e774/design/assets/MERMAID_RIG_CHANGES.md)

The animator confirmed that LottieFiles Creator collapsed the approved master into one drawable layer, even after detaching/breaking its scene. These 16 files adapt the packaging to that importer behavior: import each file as its own component and animate the resulting layers.

**These are import adapters, not new canonical artwork.** No redesign, redraw, recoloring, simplification, coordinate changes or pre-animation was performed. The approved master is unchanged. Native Creator import of this adapter pack still needs animator verification; the tests below establish source and reconstruction fidelity.

## Shared canvas — do not crop

Every SVG retains exactly:

```xml
width="512" height="512" viewBox="0 0 512 512"
```

All artwork stays in the approved coordinate system and origin. Do not crop to visible part bounds, auto-fit each piece separately, normalize its shape coordinates or add a visible background. Place every full-canvas part at **x=0, y=0**, at identical scale, on one shared 512 × 512 composition. If an importer discards empty canvas space, verify its placement against the pinned master before animating; do not assume trimmed artwork bounds are the original frame.

Keep the imported layer names equal to the filenames below, even if Creator substitutes the common source-wrapper name. Original ancestor wrappers and root `fill="none"` remain in each export to preserve inherited rendering behavior.

## Normal pose stack

Back to front (bottom layer to top layer):

1. `hair-back.svg`
2. `body-torso.svg`
3. `tail-fin-left.svg`
4. `tail-fin-right.svg`
5. `tail.svg`
6. `arm-left.svg`
7. `arm-right.svg`
8. `shell-top.svg`
9. `face-head.svg`
10. `eyes-open.svg`
11. `cheeks.svg`
12. `mouth-smile.svg`
13. `hair-front.svg`
14. `bubbles-sparkles.svg`

Normal pose uses **`eyes-open.svg` + `mouth-smile.svg`**. Keep `eyes-closed.svg` and `mouth-neutral.svg` hidden in that pose. Do not place both eye variants or both mouth variants visibly on top of each other.

## Component ownership

- `hair-back.svg` and `hair-front.svg` retain their local color regions, strands and details.
- `face-head.svg` contains `head-skin` and the fixed `nose`. It excludes both eye variants, cheeks and both mouth variants. The nose stays with the head; it does not overlap the separated expression shapes, and the exact reconstruction test passes.
- `eyes-open.svg` preserves pupils and highlights. `eyes-closed.svg` preserves both eyelid groups and their two original clipping definitions; those local clip references resolve within that SVG.
- `mouth-smile.svg` contains the source path named **`mouth`**. The filename is an adapter label, not a geometry or source-ID change.
- `mouth-neutral.svg` contains the original neutral-mouth line. `cheeks.svg` contains both blush shapes.
- `body-torso.svg` retains the complete source torso.
- `shell-top.svg` retains both shells, the center ornament and ridge details.
- `arm-left.svg` and `arm-right.svg` each keep their own hand/detail artwork.
- `tail.svg` includes the tail shape, highlight, waist/scale/contour details. Each fin file includes its local fin detail.
- `bubbles-sparkles.svg` retains the original three decorative shapes.

Each of the **41 original drawing elements** belongs to exactly one exported component, counting the alternate-expression elements. No drawable geometry was duplicated or dropped. Clipping-definition rectangles remain supporting definitions, not visible artwork.

## Expression variants and hello

The master has `display="none"` on **`eyes-closed`** and **`mouth-neutral`**. That attribute was removed only in each variant's own standalone export, making both files visible and independently importable. Their geometry and clipping are unchanged. The animator controls layer visibility/opacity after import. The normal and alternate states remain separate files.

**Hello wave = `arm-right`, viewer-right.** Set its pivot at the shoulder/root in Creator and author the wave there. The SVGs contain no animation.

## Validation performed before commit

Source SVG SHA-256: `e291873525a7c427a8581c6b9563a60f896fca6f8ee41d131ecf9e4a68887257`.

| Check | Result |
|---|---|
| Normal exported SVGs stacked at (0,0), rendered against approved master at 512 × 512 | **0 differing pixels; max channel difference 0** |
| Same normal reconstruction at 1024 × 1024 | **0 differing pixels; max channel difference 0** |
| Alternate reconstruction at 512 × 512, compared with approved master after only eye/mouth visibility toggles | **0 differing pixels; max channel difference 0** |
| Independently rasterized normal components alpha-composited at 512 × 512 | 557 pixels differ by at most 2/255 per channel from the single-pass master render; this is separate-surface rasterization/compositing rounding, not changed vector geometry |
| Original drawable attributes | Preserved exactly; only requested `display="none"` removals |
| Drawable ownership | 41/41 original elements accounted for exactly once |
| Dimensions, viewBox and origin | Identical across all 16 SVGs |
| Hidden variants | Visible standalone; nonempty rendered pixels; original clip definitions retained |
| Approved master | Unmodified |

Rendering used the same SVG renderer for both approved and reconstructed scenes. The primary vector reconstruction is pixel-identical at both tested resolutions; the separate raster-layer check is reported independently rather than described as an exact pixel match.

## Files

Exactly 16 SVG adapters plus this README are committed in this directory. For animation use, fetch files from the **adapter commit SHA**, not a moving `main` URL. Existing application behavior and animation safety requirements remain unchanged by this packaging-only export.
