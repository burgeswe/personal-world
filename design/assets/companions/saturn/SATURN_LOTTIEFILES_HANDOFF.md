# Personal World — Saturn pet source rig

**Source:** `saturn-source-rig.svg` · 512 × 512 viewBox · transparent background.
**Preview:** `saturn-preview.png` (reference only; import the SVG).
**Status:** editable vector artwork in a neutral idle pose, not final animation. No keyframes, markers, constraints or pivots are embedded. SVG structure and rendered appearance were checked; LottieFiles import and app playback remain unverified.

## Character direction

A proposed main Personal World pet: a friendly, unmistakably round Saturn-like globe with a wide tilted ring. Buttercream and peach make the planet feel warm; lavender and mint connect it to the mermaid companion. Aubergine-brown outlines, rosy cheeks and a small smile keep both pets in the same visual family. This is a stylized character, not an astronomical diagram.

Keep the circular silhouette, clear ring opening and readable face. No arms are necessary: a modest tilt or nod can greet the user. The companion should feel calm, present and observant.

## Layer map

All coordinates use the 512-unit source. Left/right refer to the viewer.

| Group | Role |
|---|---|
| `saturn-pet` | Whole pet; excludes decorative sparkles |
| `ring-back` | Rear half of ring, stripe and local outlines; behind globe |
| `globe` | Parent for body, bands, highlight, outline and face |
| `planet-body` | Buttercream circular disc |
| `cloud-bands` | Three peach atmospheric bands |
| `planet-highlight` | Optional soft highlight stroke |
| `outline-details` | Circular planet outline; follows body |
| `face` | Parent for all facial features |
| `eye-left`, `eye-right` | Independently editable eyes and tiny highlights |
| `cheek-left`, `cheek-right` | Separate blush shapes |
| `mouth` | Simple smile path |
| `ring-front` | Front half of ring, stripe, highlight and outlines; above globe |
| `sparkles` | Optional accents outside the pet parent |
| `sparkle-left`, `sparkle-right`, `orbit-dot` | Independently removable accents |

**Preserve painter order:** ring-back → globe → ring-front. Both ring halves share a center at **(256, 280)** and a baked-in **−18°** tilt. Set their anchors to the same center and drive them with one shared control; do not rotate one half independently. A whole-pet control can pivot around **(256, 250)**. The globe center is **(256, 242)**. These are anchor suggestions, not an authored rig.

Keep body, bands, highlight, face and circular outline together. The cloud-band shapes meet the disc edge without masks; do not translate them independently beyond that edge. Use shape changes if atmospheric drift is needed. Keep facial changes subtle and clear of the front ring. Large ring tilts, spins or 3D rotations require reworking geometry and occlusion; this source supports restrained 2D animation.

All artwork uses solid fills, simple paths/circles/ellipses and normal strokes. There are no raster images, filters, masks, gradients, external resources or fonts. Strokes remain attached to their owning components.

## Semantic animation contract

Deliver one master with six named segments and documented frame ranges:

| State | Playback | Suggested expression |
|---|---|---|
| `idle` | Seamless loop | Almost-still float, occasional soft blink |
| `listening` | Seamless loop | Small attentive tilt, open eyes |
| `thinking` | Seamless loop | Restrained upward gaze and tiny settled tilt |
| `sleep` | Seamless loop | Closed eyelids, resting pose, minimal drift |
| `hello` | One-shot | Small friendly nod or tilt, then settle |
| `celebrate` | One-shot | Brief happy expression and modest lift; optional static stars |

Only the idle artwork is supplied. Author closed eyelids and any alternate mouths in the animation tool; keep the source IDs recognizable. Match loop endpoints without jumps.

The **app owns state selection, interruption, transitions and the destination after one-shots**. No embedded dotLottie state machine and no authored bridge segments. App-side transitions may use 200–300 ms ease-out where motion preferences permit, never exceeding the project hard cap of 300 ms. The existing project brief includes a conflicting 400 ms sleep entry; follow the stricter hard cap.

## Motion safety and acceptance

- Respect reduced-motion and animation-off settings: static poses only, with no animation or animated crossfades. Supply a static pose for each state and suppress decorative accents when disabled.
- No flashes, rapid pulsing, shaking, spinning or revolving motion, continuous rocking or large bounces. Celebration lasts 0.5–1 second with soft, desaturated accents and never repeats automatically.
- Validate idle excursion at the actual **48 px rendered size: no more than 2 px visible movement**. Account for padding and actual rendered bounds rather than guessing a source-unit ratio.
- Check **32, 48 and 64 px** on light and dark surfaces. Hide sparkles, tiny eye highlights and other fine detail if needed. Preserve the globe/ring silhouette and face.
- Motion and color supplement app labels; they must not be the only way to understand a state. The app supplies accessible state text and hides redundant decorative artwork from assistive technology.
- Check ring alignment, face clearance and viewport clipping at all animation extremes. Keep both ring halves synchronized.

Confirm that the import preserves editable groups, then validate the final export in the actual app renderer. Return the master animation, segment/frame map, static state poses and any remaining limitations. This deliverable is a source asset, not a tested Lottie animation or an installed app change.
