# Personal World — Little helper robot

**Source:** `robot-source-rig.svg` · 512 × 512 · transparent background.
**Preview:** `robot-preview.png` (reference only; import the SVG).
**Status:** layered static source rig, not final animation. No authored anchors, constraints, state markers or keyframes. SVG structure and rendering were checked; LottieFiles import and actual app playback are unverified.

## Character intent

Mint body, powder-blue head, a warm face screen, heart panel, lavender joints and little boots. Keep round corners and the aubergine-brown outlines; the heart is a painted emblem, not a flashing status light.

Use the existing companion family's soft mint, pink, lavender, cream and blue palette, solid fills and dark warm outlines. Expressions should feel calm and friendly.

## Layer map and rig notes

Left/right mean viewer-left/right. Pivot coordinates below are suggested source-space anchors, not embedded rigging. Root: `robot-pet`.

| Group IDs | Role / pivot |
|---|---|
| `antenna` | Stem and pastel tip; pivot (256, 137). |
| `head` | Head shell, screen, face and highlight; pivot (256, 252). |
| `ear-left / ear-right` | Side caps; parent to the head control. |
| `body / chest-panel` | Torso and heart panel; pivot (256, 345). |
| `arm-left / arm-right` | Whole curved arms with claw hands; pivots (186, 274) / (326, 277). |
| `leg-left / leg-right` | Legs and boots; pivots (218, 344) / (294, 344). |
| `outline-details` | Body seams; parent to body so details do not drift. |
| `face` | Parent for `eye-left`, `eye-right`, `cheeks`, `mouth`; follows its owning head/window. |
| `sparkles` | Optional static decorative stars; hide at small sizes or when disabled. |

Keep the head and side caps together. Arms are single curved source shapes; independent elbow or finger articulation needs extra geometry. The raised viewer-right claw overlaps the head in the neutral pose; preserve that depth or adjust painter order deliberately for a wave.

Preserve painter order and local details within their owners. Outlines are ordinary strokes attached to shapes, not a separate stationary overlay. All artwork uses simple paths, rectangles, circles and ellipses with solid fills. No raster embeds, filters, masks, external resources, text or fonts. Closed eyelids and alternate mouths still need authoring. Some large gestures require extending hidden geometry rather than stretching the source.

## Six semantic segments

Deliver one master animation with named segments and a documented frame range for each:

| State | Playback | Suggested motion |
|---|---|---|
| `idle` | Loop | Very subtle settled float and occasional blink |
| `listening` | Loop | Small head tilt and attentive eyes |
| `thinking` | Loop | Upward gaze with a quiet head tilt |
| `sleep` | Loop | Closed eyes, lowered or settled arm |
| `hello` | One-shot | Small claw wave, then settle |
| `celebrate` | One-shot | Brief open smile and modest arm lift |

Loops must match at endpoints without jumps. **The app owns transitions, interruption and the next state after one-shots.** No embedded dotLottie state machine and no authored bridge segments. Use app-side ease-out transitions of 200–300 ms where motion is permitted; never exceed the project's 300 ms hard cap. The older project brief has a conflicting 400 ms sleep entry; follow the stricter cap.

## Accessibility and acceptance

- Reduced motion and animation-off mean **static poses only**: no ambient animation or animated crossfades. Supply a usable static pose for each semantic state.
- No flashing, strobing, rapid brightness pulses, shaking, fast reversals, continuous rotation, parallax or large bounces. A drawn heart, headlight or star must not become a flashing indicator.
- Idle visible excursion is **at most 2 px at the actual 48 px rendered size**. Verify actual bounds/padding instead of assuming a source-unit conversion. A gentle idle loop may use a 3–4 second period.
- Celebration lasts **0.5–1 second**, uses soft/desaturated accents if any, and never automatically repeats. The app chooses its next state.
- Inspect at **32, 48 and 64 px** on light and dark surfaces. Simplify decorative detail and hide stars as needed. Verify clipping, joints, contact points and face visibility at animation extremes.
- App text and accessible state labels carry meaning; motion/color are supplementary. Hide redundant decorative artwork from assistive technology when the app label already conveys its state.

Confirm that import preserves editable groups. Return the master animation, segment/frame map, static state poses and documented limitations after testing in the app renderer. These files do not install or replace the live pet.
