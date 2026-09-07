# Personal World — Taco truck & newspaper stand

**Source:** `taco-news-truck-source-rig.svg` · 512 × 512 · transparent background.
**Preview:** `taco-news-truck-preview.png` (reference only; import the SVG).
**Status:** layered static source rig, not final animation. No authored anchors, constraints, state markers or keyframes. SVG structure and rendering were checked; LottieFiles import and actual app playback are unverified.

## Character intent

One combined pet: a mint taco truck that also sells newspapers. Keep the taco roof sign, pink striped awning, smiling serving window, lavender wheels and visible newspaper rack together. Do not split this into a separate truck and kiosk.

Use the existing companion family's soft mint, pink, lavender, cream and blue palette, solid fills and dark warm outlines. Expressions should feel calm and friendly.

## Layer map and rig notes

Left/right mean viewer-left/right. Pivot coordinates below are suggested source-space anchors, not embedded rigging. Root: `taco-news-truck-pet`.

| Group IDs | Role / pivot |
|---|---|
| `truck-body / body-stripe` | Vehicle shell and pastel stripe; main control pivot (250, 350). |
| `wheel-left / wheel-right` | Wheel assemblies; centers (176, 364) / (350, 364). |
| `cab-window / door` | Cab glazing and door details; attach to vehicle shell. |
| `service-window` | Cream window and nested face; expression area. |
| `awning` | Canopy and cream stripe paths; pivot (204, 194). |
| `serving-counter` | Counter under face window; fixed to truck. |
| `taco-sign` | Sign with posts, filling and shell; pivot (207, 194). |
| `newspaper-rack` | Combined paper/rack assembly; attach to truck. |
| `paper-back / paper-front` | Individual papers; avoid pulling them out during idle. |
| `rack-frame` | Lavender newspaper holder; preserve the paper overlap. |
| `headlight / bumper` | Fixed cab trim; headlight is a solid painted shape, never a flash. |
| `face` | Parent for `eye-left`, `eye-right`, `cheeks`, `mouth`; follows its owning head/window. |
| `sparkles` | Optional static decorative stars; hide at small sizes or when disabled. |

Keep the taco sign and newspaper rack legible: both are essential to this character. Wheels are riggable but should not spin continuously or suggest travel during idle. If the truck settles, move the sign, counter, rack and window with it. Stripes are authored paths without clipping; deform them with the awning or keep that assembly rigid. Tiny newspaper rules are decorative and may be removed at 32 px. This source contains no text or font dependencies.

Preserve painter order and local details within their owners. Outlines are ordinary strokes attached to shapes, not a separate stationary overlay. All artwork uses simple paths, rectangles, circles and ellipses with solid fills. No raster embeds, filters, masks, external resources, text or fonts. Closed eyelids and alternate mouths still need authoring. Some large gestures require extending hidden geometry rather than stretching the source.

## Six semantic segments

Deliver one master animation with named segments and a documented frame range for each:

| State | Playback | Suggested motion |
|---|---|---|
| `idle` | Loop | Blink in the serving window; parked and almost still |
| `listening` | Loop | Attentive eyes; small held expression change |
| `thinking` | Loop | Gentle upward glance; truck remains parked |
| `sleep` | Loop | Closed window-eyes; no flashing headlight |
| `hello` | One-shot | Brief happy nod of the whole pet or expression change |
| `celebrate` | One-shot | Happy face and a tiny single suspension lift; papers stay in rack |

Loops must match at endpoints without jumps. **The app owns transitions, interruption and the next state after one-shots.** No embedded dotLottie state machine and no authored bridge segments. Use app-side ease-out transitions of 200–300 ms where motion is permitted; never exceed the project's 300 ms hard cap. The older project brief has a conflicting 400 ms sleep entry; follow the stricter cap.

## Accessibility and acceptance

- Reduced motion and animation-off mean **static poses only**: no ambient animation or animated crossfades. Supply a usable static pose for each semantic state.
- No flashing, strobing, rapid brightness pulses, shaking, fast reversals, continuous rotation, parallax or large bounces. A drawn heart, headlight or star must not become a flashing indicator.
- Idle visible excursion is **at most 2 px at the actual 48 px rendered size**. Verify actual bounds/padding instead of assuming a source-unit conversion. A gentle idle loop may use a 3–4 second period.
- Celebration lasts **0.5–1 second**, uses soft/desaturated accents if any, and never automatically repeats. The app chooses its next state.
- Inspect at **32, 48 and 64 px** on light and dark surfaces. Simplify decorative detail and hide stars as needed. Verify clipping, joints, contact points and face visibility at animation extremes.
- App text and accessible state labels carry meaning; motion/color are supplementary. Hide redundant decorative artwork from assistive technology when the app label already conveys its state.

Confirm that import preserves editable groups. Return the master animation, segment/frame map, static state poses and documented limitations after testing in the app renderer. These files do not install or replace the live pet.
