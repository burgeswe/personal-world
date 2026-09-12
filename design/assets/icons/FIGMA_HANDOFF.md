# Figma handoff — Project Worlds production icon system

(Formerly "Personal World" — product renamed 2026-09-12; the companion
icon "Personal World" keeps its name.)

**Prepared:** September 2026  
**Repository:** `burgeswe/personal-world`  
**Validated asset commit:** `7b92a236902b626f12d9459eaa4d6dc522273468`  
**Pack path:** `design/assets/icons/`

## Mission

Turn the supplied production SVG pack into a reusable Figma Design icon library without redrawing, tracing, auto-generating, or recoloring the source geometry. The generated icon sheets were art direction only; these SVGs are the reviewed production masters.

Chat is a first-class Project Worlds surface. Its complete family must remain easy to find beside Today, Worlds, Journal, Projects, and Settings.

## Pinned sources

- Import library: https://raw.githubusercontent.com/burgeswe/personal-world/7b92a236902b626f12d9459eaa4d6dc522273468/design/assets/icons/figma-icon-library.svg
- Manifest: https://raw.githubusercontent.com/burgeswe/personal-world/7b92a236902b626f12d9459eaa4d6dc522273468/design/assets/icons/manifest.json
- Individual SVGs: https://github.com/burgeswe/personal-world/tree/7b92a236902b626f12d9459eaa4d6dc522273468/design/assets/icons/svg
- Visual reference: https://raw.githubusercontent.com/burgeswe/personal-world/7b92a236902b626f12d9459eaa4d6dc522273468/design/assets/icons/contact-sheet.png

## Build the library

1. Create or open **Personal World — Icon Library**.
2. Add pages: **Cover**, **Components**, **Companions**, **QA**, and **Archive**.
3. Import `figma-icon-library.svg` into **Components**.
4. Preserve it in a locked section named **Source / 7b92a23**.
5. Copy each centered icon into its own 24×24 frame and convert it to a main component.
6. Use the exact `component` name from `manifest.json`.
7. Use center/center constraints. Do not add a background or hit-area rectangle inside the component.
8. Add the manifest semantic description and accessibility note to the component description.
9. Arrange sections in manifest order.

Figma uses slash-separated names to organize the Assets panel. Preserve names such as `Icon/Navigation/Chat`, `Icon/Chat-Ai/Send`, and `Icon/Companion/Little Helper`.

Keep all 72 glyphs as individual components. Figma advises against using variants to group different icons.

## Component rules

Application glyphs:

- 24×24 frame and original geometry
- 2px stroke with round cap and join
- no background, shadow, gradient, mask, raster fill, filter, or effect
- bind stroke/fill to a semantic foreground variable matching repository `currentColor`

Use size variants only for the same icon: `Size=16 | 20 | 24 | 32 | 48 | 64`. Keep 24px as the master. Use a 1.5px optical stroke at 16px and 1.75–2px at 20px only after actual-size inspection.

Companion marks retain their approved palette. Do not bind them to status variables, create expression variants, or treat them as canonical source art. Use the full repository rigs for large character placements.

## Variables and themes

Mirror `design/tokens.json`; do not create a Figma-owned token source.

| Figma variable | Dark | Light | Repository mapping |
|---|---:|---:|---|
| `color/text/primary` | `#f0eaff` | `#26241f` | primary text |
| `color/text/secondary` | `#a397b8` | `#6b675f` | secondary/muted text |
| `color/surface/canvas` | `#0a0810` | `#f4f2ed` | canvas |
| `color/surface/panel` | `#12101a` | `#ece9e1` | panel |

Interface icons switch with semantic foreground. Companion marks retain approved colors. Never derive tokens from labels rendered in the generated concept images.

## Required QA

Create:

1. Dark / 24px — all 72 icons.
2. Light / 24px — all 72 icons.
3. Actual size / 16px — interface icons at 100% zoom.
4. Actual size / 20px — interface icons at 100% zoom.
5. Actual size / 24px — all icons at 100% zoom.
6. Scale / 32–64px — representative navigation, Chat, status, and companion assets.
7. Semantic examples — labeled controls for Send message, Open World assistant, View sources, and Settings.

Check optical centering, apparent weight, accidental fills, malformed paths, corners, endpoints, actual-size legibility, and light/dark behavior. Report issues by exact component name for repository correction instead of silently changing masters.

## Accessibility

- Put accessible names on the containing control; application SVG artwork is decorative.
- Pair status icons with explicit status words.
- Companion artwork is `aria-hidden` when a control supplies the useful label.
- Color, position, motion, glow, and expression never carry meaning alone.
- Keep focus treatment on the control.
- Visible icons may be 16–24px; targets remain at least 44×44 CSS px.
- Do not add animation; Project Worlds defaults to reduced motion.
- Let interface glyphs inherit platform foreground in forced-colors mode.

## Publish

After QA passes, publish the file as **Personal World — Icon Library** from the Assets/Libraries panel. Publish finished components and semantic variables only; hide source boards and QA helpers.

Release description:

`Initial production icon system from repository commit 7b92a23: 67 currentColor interface glyphs, 5 canonical-source companion marks, complete first-class Chat family, semantic manifest, and 16/20/24px QA.`

Publishing requires a paid plan and suitable edit access. If unavailable, keep components local and return the file link; do not flatten or detach them.

## Round-trip export

Export Navigation/Chat, Chat-Ai/Send, Chat-Ai/Sources, Status-Feedback/Warning, and Companion/Personal World.

Use SVG export with **Include “id” attribute** enabled so IDs derive from layer names. Keep the 24×24 bounding box. Compare with repository masters for viewBox, bounds, round caps/joins, masks, geometry, semantic color behavior, companion colors, raster embeds, and external references. Figma may transform SVG structure; require visual equivalence and portable output rather than byte equality.

## Definition of done

Return:

1. Figma file URL and name.
2. Published status or exact plan/access limitation.
3. Main component count; expected 72.
4. Category counts matching `manifest.json`.
5. Confirmation that all 11 Chat icons are present.
6. Confirmation that distinct icons remain individual components.
7. Dark/light QA screenshots.
8. 16/20/24px actual-size QA screenshots.
9. Five representative round-trip export results.
10. Every master changed, with reason and before/after evidence.
11. Confirmation that canonical companion art was not overwritten.

Component existence alone is not completion. QA and representative round-trip export are required.

## Official Figma references

- [Add images and videos](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs)
- [Guide to components](https://help.figma.com/hc/en-us/articles/360038662654-Guide-to-components-in-Figma)
- [Create and use variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants)
- [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties)
- [SVG export settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs)
- [Publish a library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library)
