# Personal World — planet pet source rig

**Source:** `personal-world-source-rig.svg` · 512 × 512 viewBox · transparent background.
**Preview:** `personal-world-preview.png` (reference only; import the SVG).
**Status:** editable vector artwork in a neutral idle pose, not final animation. Both ring groups have explicit matching local origins and SVG transforms. The shared-controller setup is documented in `personal-world-ring-rig.json`; an animator must create and link that control after import. No keyframes or state markers are embedded. Neutral rendering is pixel-identical to the prior source, and three ring-only tilt poses were visually checked. LottieFiles import and app playback remain unverified.

## Character direction

**Character name: Personal World** (formerly called Saturn in asset filenames). The main Personal World pet is a friendly, unmistakably round Saturn-like globe with a wide tilted ring. Buttercream and peach make the planet feel warm; lavender and mint connect it to the mermaid companion. Aubergine-brown outlines, rosy cheeks and a small smile keep both pets in the same visual family. This is a stylized character, not an astronomical diagram.

Keep the circular silhouette, clear ring opening and readable face. No arms are necessary: a modest tilt or nod can greet the user. The companion should feel calm, present and observant.

## Layer map

All coordinates use the 512-unit source. Left/right refer to the viewer.

| Group | Role |
|---|---|
| `personal-world-pet` | Whole pet; excludes decorative sparkles |
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

## Ring animation controls

**Preserve painter order:** `ring-back` → `globe` → `ring-front`. The ring halves must remain separate layers so the globe can sit between them.

Both ring groups now use **local anchor (0, 0)** with **position (256, 280)**. Their paths are rebased around that local origin. Neutral transforms are identical:

```svg
transform="translate(256 280) rotate(0) scale(1 1)"
```

The visible −18° tilt is already baked into the shape coordinates; rotation is an additional delta. To adjust the ring without moving the planet, apply the same transform to both groups. For example, `translate(256 280) rotate(4) scale(1 1)` changes only the ring's tilt by +4°.

In the animation tool, create a **shared `rings` control** and link both halves' position, rotation and scale to it. Keep the globe outside that control. The `data-rig-control` attributes and JSON file are descriptive source metadata; SVG does not automatically bind these siblings, and importers may drop metadata. Verify the links explicitly after import.

**Authoring files:**
- `personal-world-ring-rig.json`: machine-readable target IDs, origin, default transforms, suggested bounds and motion constraints. This is a custom source mapping, not an importable Lottie state machine.
- `personal-world-ring-poses.png`: checked −4°, neutral and +4° ring-only poses, with the globe staying fixed.

Use **±4° as an initial range for brief pose changes**, not a validated limit for every possible animation. For subtle idle motion, start within **±1.4°** and measure total visible excursion at 48 px, including any other movement. The ring may make a small tilt, settle or change position as part of a state gesture; keep motion smooth, brief and non-spinning. No continuous rotation or endless rocking.

A whole-pet control may pivot around **(256, 250)**. Globe center: **(256, 242)**. These two controls still need setup in the animation tool.

Keep body, bands, highlight, face and circular outline together. The cloud-band shapes meet the disc edge without masks; do not translate them independently beyond that edge. Use shape changes if atmospheric drift is needed. Keep facial changes subtle and clear of the front ring. Large ring tilts, spins or 3D rotations require reworking geometry and occlusion; this source supports restrained 2D animation.

All artwork uses solid fills, simple paths/circles/ellipses and normal strokes. There are no raster images, filters, masks, gradients, external resources or fonts. Strokes remain attached to their owning components.

## Semantic animation contract

Deliver one master with six named segments and documented frame ranges:

| State | Playback | Suggested expression |
|---|---|---|
| `idle` | Seamless loop | Almost-still float, occasional soft blink; ring normally settled |
| `listening` | Seamless loop | Small attentive pose and optional ring tilt, then hold |
| `thinking` | Seamless loop | Restrained upward gaze and tiny settled tilt |
| `sleep` | Seamless loop | Closed eyelids, resting pose, minimal drift |
| `hello` | One-shot | Small friendly ring tilt or nod, then settle |
| `celebrate` | One-shot | Brief happy expression and small ring flourish; optional static stars |

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

## Import preparation

See the collection’s `IMPORT_GUIDE.md` and `COMPATIBILITY_AUDIT.json`. Every source group and drawable shape has a stable unique ID; paint settings are explicit, and the neutral render is unchanged. Preserve nested layers and use editable vector import. Native Figma/Lottie Creator import and final app playback still require the checks described in the guide.
