# Project Worlds icon system

(Formerly "Personal World" — product renamed 2026-09-12; the companion
slot/icon named "Personal World" keeps its name; schema identifiers unchanged.)

Production vector icons for Project Worlds. Concept sheets established the friendly, rounded direction and taxonomy; every glyph here was rebuilt as deterministic geometry on a 24x24 grid.

## Contents

- `svg/`: 72 standalone SVG assets (67 interface glyphs and 5 companion identity marks)
- `figma-icon-library.svg`: import index with one named group per proposed Figma component
- `sprite.svg`: symbol sprite for application use
- `manifest.json`: component names, semantics, categories, paths, and canonical companion sources
- contact-sheet SVG/PNG files: visual QA at reference and actual 16/20/24px sizes

## Figma import

Drag `figma-icon-library.svg` into a Figma Design canvas. Each tile has a stable group name in the form `Icon/Category/Name`. Move the 24x24 artwork from each tile into a 24x24 component frame, preserve the component name, then publish the set as a library. Individual SVG files can also be imported directly.

Use the manifest as the machine-readable mapping between component names and exported filenames. Treat SVG IDs and component names as stable API.

## Application use

Interface glyphs use `currentColor`. Place them inside a labeled button or link and let the canonical semantic text token control color.

```html
<button aria-label="Send message">
  <svg aria-hidden="true" width="24" height="24">
    <use href="/assets/icons/sprite.svg#icon-chat-ai-send"></use>
  </svg>
</button>
```

The five companion marks retain approved source-rig colors. They are compact silhouette reductions, not replacements for canonical artwork. Their source files are recorded in `manifest.json`.

## Accessibility

- Icons never carry meaning alone. Pair interactive icons with visible text where practical and always provide an accessible name.
- Decorative glyphs and companion marks use `aria-hidden="true"`. Companion expressions and colors never communicate system status.
- Interface icons inherit `currentColor`. Use canonical text tokens and verify them against the actual background.
- Status icons supplement the repository's explicit status words; shape and labels carry meaning.
- Keep interactive targets at least 44x44 CSS px even when the visible glyph is smaller.
- Do not animate by default. Respect reduced motion and the companion motion contract.
- In forced-colors mode, allow interface glyphs to inherit platform color.

## Size guidance

| Size | Guidance |
|---|---|
| 16px | Use simple glyphs only; use a 1.5px optical stroke when supported. Avoid dense companion marks. |
| 20px | All interface glyphs are supported; use a 1.75px to 2px optical stroke. |
| 24px | Master size; use source geometry and 2px stroke unchanged. |
| 32px | Scale the master and preserve optical weight. Companion marks become acceptable. |
| 48px | Feature controls or compact companion identity; prefer canonical companion art when detail matters. |
| 64px | Prefer canonical companion art for empty states and character presence. |

Pixel-align horizontal and vertical strokes after scaling.

## Design contract

The governing sources are `design/tokens.json` and `docs/accessibility/ACCESSIBILITY_CONTRACT.md`. Generated hex labels from concept imagery are not design tokens. Preview boards use canonical aubergine surfaces; production interface SVGs contain no fixed interface color.

Companion marks derive from:

- the operator Mermaid: `design/assets/mermaid-source-rig-v2.svg`
- Little Helper: `design/assets/companions/robot/robot-source-rig.svg`
- World-tree Squirrel: `design/assets/companions/world-tree-squirrel/world-tree-squirrel-source-rig.svg`
- Tacos & the Morning Paper: `design/assets/companions/taco-news-truck/taco-news-truck-source-rig.svg`
- Personal World: `design/assets/companions/personal-world/personal-world-source-rig.svg`

The refinement pass normalized grid, stroke, cap/join treatment, corner radii, optical centering, spacing, symmetry, metaphors, and compact legibility. Generated text and traced raster geometry are absent.

Validation checks XML parsing, viewBoxes, raster embeds, external resources, fonts, filters, scripts, fixed interface colors, manifest parity, duplicate names, and rendered 16/20/24px output.
