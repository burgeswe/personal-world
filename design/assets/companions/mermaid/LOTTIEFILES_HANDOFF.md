# Mermaid source rig — LottieFiles handoff

**Asset:** `mermaid-source-rig.svg` · 512 × 512 viewBox · transparent background.
**Status:** layered vector source in a neutral idle pose, not final animation. No keyframes, markers, pivots, constraints or state machine are authored. SVG rendering and structure were checked; LottieFiles import and playback remain unverified. `mermaid-preview.png` is a visual preview only; import the SVG for editable artwork.

## Design intent

Redrawn from the uploaded reference recovered from “Catch Up On Benchmarks.” Preserve the cute pastel pink/lilac/mint/blue hair, warm skin, teal tail and aubergine-brown outlines. The deliberate changes are a smaller head relative to the full silhouette, a visible neck/torso/waist, a long curved tapering tail and two distinct fins. Keep this unmistakable mermaid silhouette rather than returning to an oval lower body. Flat pastel regions replace gradient/raster treatments for a simple source.

She is a quiet companion in Personal World: friendly, observant and calm. Movement should feel alive without demanding attention.

## Layer map

Names use **viewer-left / viewer-right**. Coordinates below are suggested starting pivots in the 512-unit source, not embedded rigging.

| Group ID | Contents / intended use | Suggested pivot |
|---|---|---|
| `mermaid` | Whole character plus optional accents | (234, 279) |
| `hair-back` | Lilac hair mass, blue and mint locks | (235, 100) |
| `hair-front` | Pink fringe/sweep, mint lock, strand details | (231, 88) |
| `face-head` | Head shape and nested `face-details` | (234, 192) |
| `body-torso` | Neck and torso under head/top/arms | (234, 279) |
| `arm-left` | Viewer-left arm, hand and hand detail | (195, 226) |
| `arm-right` | Viewer-right bent arm, hand and hand detail | (271, 226) |
| `shell-top` | Two shells, ridges and center ornament | (233, 241) |
| `tail-assembly` | Parent for tail and both fins | (233, 284) |
| `tail` | Curved teal body, highlight and details | (233, 284) |
| `tail-fin-left` | Upper fin and its vein | (351, 397) |
| `tail-fin-right` | Right/lower fin and its vein | (351, 397) |
| `outline-details` | Waist seam, scales and tail contour; nested in `tail` | Follow tail |
| `bubbles-sparkles` | Optional decorative accents; removable | Per shape |

Outlines are strokes on their owning shapes, so they move with each part. Local facial, shell, hair, hand and fin details stay within their respective groups; do not detach them into a stationary global outline. `face-details` contains `eyes-open`, `cheeks`, `nose` and `mouth`. Author closed eyelids for blink/sleep; they are not supplied as a second pose.

Preserve painter order and named groups on import. Set anchors in the animation tool. For a coordinated head tilt, parent the head and both hair groups to a head control, then animate local hair drift separately. Keep the shell top attached to the torso and fin roots attached to the tail tip. Shoulder/neck/fin overlaps are starting geometry: inspect them throughout movement and extend hidden artwork if needed. Large arm changes or a waving elbow may need additional paths; this is a starting rig.

## Semantic segments

Deliver one master animation with six named segments/markers and a documented frame range for each:

| Segment | Playback | Intent |
|---|---|---|
| `idle` | Seamless loop | Subtle breathing and hair/tail drift |
| `listening` | Seamless loop | Attentive posture, restrained tilt |
| `thinking` | Seamless loop | Gentle contemplative pose |
| `sleep` | Seamless loop | Closed eyes, very quiet resting motion |
| `hello` | One-shot | Small friendly wave |
| `celebrate` | One-shot | Brief, modest lift or fin flourish |

Match loop endpoints without a visible jump. The **app owns state selection, interruption and transitions**, including the destination after one-shots. No embedded dotLottie state machine and no authored bridge segments. Use app-side transitions/crossfades, 200–300 ms ease-out where motion preferences permit; never exceed the project hard cap of 300 ms. The existing project timing table includes a conflicting 400 ms sleep entry; use the stricter hard cap.

## Accessibility and acceptance

- Respect reduced-motion and animation-off preferences: static poses only, with no animation or animated crossfades. Supply a usable static pose for every semantic state and suppress decorative accents when disabled.
- No flashing, strobing, rapid pulsing, shaking or large bounces. No continuous rotation. Celebration lasts 0.5–1 second with soft, desaturated accents and never repeats automatically.
- Validate idle movement at the actual **48 px display size: visible excursion no more than 2 px**. Check rendered bounds and padding; do not assume a 21-unit source displacement is correct.
- Inspect at **32, 48 and 64 px** on light and dark surfaces. Simplify tiny details/accents where needed; preserve silhouette. Check extrema for clipping and exposed joints.
- Meaning must remain available through app text/accessible labels; motion and color are supplementary. The app should hide decorative artwork from assistive technology when a separate label already conveys the state.

Use simple paths, solid fills and ordinary strokes. The SVG has no raster embeds, filters, masks, fonts, external resources or animation. Confirm editable group preservation during import, then validate the exported animation in the actual app renderer. Return the master animation, segment/frame map and static state poses with any import or playback limitations documented.
