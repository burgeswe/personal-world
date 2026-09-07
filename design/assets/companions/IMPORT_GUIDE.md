# Figma and LottieFiles import guide

## Start here

Use each pet's **`*-source-rig.svg`** for editable artwork. PNGs are visual references. ZIPs are download containers; extract them first. The ring-rig JSON is a custom control map, not a Lottie animation file.

These five SVGs use a 512 × 512 viewBox, transparent background, solid fills, ordinary centered strokes, named groups and simple vector shapes. Every drawable shape has a unique ID and explicit paint attributes. There are no fonts, embedded images, external resources, CSS stylesheets, masks, clipping paths, filters or blend modes. Geometry and painter order remain unchanged by the compatibility cleanup.

## Figma Design

Import the SVG into a **Figma Design canvas** as vector artwork. Figma documents that imported SVG becomes editable vector content; placing a PNG or using an SVG merely as an AI prompt reference is a different workflow. [Figma SVG import behavior](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs).

After import, expand the hierarchy and check that the named body parts remain independently selectable. Compare against the supplied PNG at the same size. Keep the 512 × 512 frame and original padding. Preserve nested grouping, transform relationships, overlaps and centered strokes. Avoid flattening the whole pet into one vector or rasterizing it.

If re-exporting from Figma, export SVG with **Include “id” attribute** enabled so layer names are represented in the SVG. Keep the editable source copy. Figma may outline strokes during export; inspect the round-trip result rather than assuming the exact source structure survives. [Figma SVG export settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs).

## Lottie Creator

Drag the source SVG onto the Creator canvas or use Upload Assets. When offered an insertion mode, choose **Vector** for editable shapes. Preserve groups, names and transforms; leave path-merging/flattening optimization off when it would combine rig parts. Creator's documentation supports SVG shapes, nested groups, layer hierarchy and transforms, with limitations on filters and some blend modes. This collection avoids those effects. [Creator importing documentation](https://docs.lottiefiles.com/en/creator/09_assets-and-importing/importing).

Expand the imported layers and check the source IDs against the pet's handoff. Move one arm, fin, tail, eye or book-leaf temporarily to confirm independent editing; undo afterwards. Set anchors and parent controls in the animation tool. SVG artwork does not carry a complete native character rig automatically.

For **Personal World**, keep `ring-back` behind `globe` and `ring-front` above it. Both ring groups have local anchor **(0, 0)**, position **(256, 280)** and the same neutral transform. Create one shared `rings` control and connect both halves' position, rotation and scale to it. Leave the globe independent. Custom `data-*` attributes/JSON describe the intended setup; they do not create links automatically. Compare ring tilts with `personal-world-ring-poses.png`.

The book tree contains 24 separately named book groups and a transformed squirrel parent. Preserve the parent transform, or bake it consistently and recalculate pivots as described in its handoff. The full book detail is most readable above compact icon sizes.

## Acceptance before final animation delivery

1. Confirm editable vector layers and recognizable group hierarchy in both target tools.
2. Compare the imported neutral pose to the PNG at 512 px and inspect 32/48/64 px on light and dark backgrounds. Simplify tiny decorations as needed.
3. Check animated extrema for exposed joints, face occlusion, clipping, ring seams and lost parent relationships.
4. Deliver semantic segments `idle`, `listening`, `thinking`, `sleep` as clean loops; `hello` and `celebrate` as one-shots. App-owned transitions; no embedded state machine.
5. Reduced motion is static only. No flashes or continuous spinning. Maximum 300 ms transitions and 2 px visible idle excursion at actual 48 px. Validate the final export in the app renderer.

## What has actually been verified

**Passed:** XML, unique IDs on every shape/group, vector-only structure, no external dependencies or unsupported effects listed above, unclipped neutral bounds, 32/48/64/512 px rendering, unchanged neutral pixels after source cleanup, matching Personal World ring origins and correct painter order. Neutral and ±4° ring poses were visually checked. File-specific counts and hashes are in `COMPATIBILITY_AUDIT.json`.

**Not yet tested:** native import into Figma or Lottie Creator, final keyframes/expressions, or playback in the application. The files are prepared for these tools; a claim of perfect native import or finished animation would go beyond the available evidence.
