# Personal World — VEFR-inspired book tree & Norse squirrel

**Source:** `world-tree-squirrel-source-rig.svg` · 512 × 512 · transparent background.
**Preview:** `world-tree-squirrel-preview.png` (reference only; import the SVG).
**Status:** layered static source rig, not final animation. No authored anchors, constraints, state markers or keyframes. SVG structure and rendering were checked; LottieFiles import and actual app playback are unverified.

## Character intent

A Ratatoskr-inspired messenger squirrel beneath Yggdrasil: mint crown filled with 24 tiny open books as leaves, broad branches, a woven trunk motif and two side-spreading roots. The downward center root has been removed, and the squirrel is about 16% smaller than the previous Norse revision. The squirrel wears a lavender cloak, round gold brooch and a blue cap, carries a tiny messenger satchel, and still holds its acorn. The optional gold circle frames the world-tree silhouette. Keep the round cheeks and large curled tail. The book-leaves are the requested VEFR-inspired design feature; they contain abstract page marks, no written lore or specific book content.

This is an original pastel fantasy interpretation. Ratatoskr's messenger role and Yggdrasil's world-spanning branches inform the concept; the two-root silhouette and book foliage are deliberate user-directed adaptations; the clothing, knot motif and halo are artistic choices, not a claimed historical reconstruction or canonical mythological symbols. No rune text is used.

Use the existing companion family's soft mint, pink, lavender, cream and blue palette, solid fills and dark warm outlines. Expressions should feel calm and friendly.

## Layer map and rig notes

Left/right mean viewer-left/right. Pivot coordinates below are suggested source-space anchors, not embedded rigging. Root: `world-tree-squirrel-pet`.

| Group IDs | Role / pivot |
|---|---|
| `tree-roots` | Parent of `root-left`, `root-right` and `root-details`; keep the two lateral roots fixed together. No center root. |
| `world-halo` | Optional quiet gold circle; static, never rotate or pulse. |
| `tree-crown` | Mint canopy silhouette; pivot (252, 211). |
| `tree-trunk / trunk-knot` | Broad branching trunk and woven motif; keep aligned with roots. |
| `book-leaves` | Parent of 24 open-book leaf groups, `book-leaf-01` through `book-leaf-24`; keep aligned with canopy. |
| `squirrel` | Parent for all squirrel parts; suggested control pivot (242, 393). |
| `squirrel-tail` | Large curled tail and inset highlight; pivot (288, 397). |
| `squirrel-body / belly` | Torso with soft belly patch; pivot (243, 390). |
| `squirrel-head` | Head, ears, muzzle, face and `norse-cap`; local pivot (242, 329). |
| `cloak-back / cloak-collar` | Lavender cloak panels; attach to squirrel body, preserving painter order. |
| `cloak-brooch` | Gold clasp inside collar; follows collar. |
| `messenger-satchel` | Strap and pouch; follows body, with any secondary movement kept minimal. |
| `paw-left / paw-right / acorn` | Hands and held acorn; move the acorn with both hands or preserve contact. |
| `foot-left / foot-right` | Feet; preserve a stable resting contact. |
| `face` | Parent for `eye-left`, `eye-right`, `cheeks`, `mouth`; follows its owning head/window. |
| `sparkles` | Optional static decorative stars; hide at small sizes or when disabled. |

The `squirrel` group has an SVG transform of `translate(56 74) scale(0.76)`. Squirrel pivots in the table are local coordinates: convert to root coordinates as x′ = 56 + 0.76x, y′ = 74 + 0.76y, or preserve the parent transform on import. All other pivots use the 512-unit root viewBox.

The tree is a quiet backdrop; avoid parallax and oscillating the entire canopy. Animate the squirrel locally with very small movements. The `book-leaves` group is a sibling of the canopy and must follow any canopy control. Each book has a local translation, rotation and scale; preserve or bake these transforms consistently on import. Animate an entire book group so its cover, pages and seam stay together. No page-turn rig is authored. Keep ears and face parented to the head, and both tail paths together. At 32 px the squirrel face, cap rivets and trunk knot become tiny: use the canopy, trunk and curled-tail silhouette as the main read; remove the trunk knot, cap rivets, halo and sparkles when simplifying. At 32–48 px, omit inner book page marks and optionally reduce the number of book-leaves; the full 24-book treatment is intended for larger display sizes. This detailed source is strongest at 64 px and above.

Preserve painter order and local details within their owners. Outlines are ordinary strokes attached to shapes, not a separate stationary overlay. All artwork uses simple paths, rectangles, circles and ellipses with solid fills. No raster embeds, filters, masks, external resources, text or fonts. Closed eyelids and alternate mouths still need authoring. Some large gestures require extending hidden geometry rather than stretching the source.

## Six semantic segments

Deliver one master animation with named segments and a documented frame range for each:

| State | Playback | Suggested motion |
|---|---|---|
| `idle` | Loop | Squirrel blink; almost-still tail |
| `listening` | Loop | Small squirrel head tilt; tree remains still |
| `thinking` | Loop | Eyes glance toward the canopy; acorn stays held |
| `sleep` | Loop | Closed eyes and settled head |
| `hello` | One-shot | Brief head nod or one paw lift after reworking acorn contact |
| `celebrate` | One-shot | Happy expression and tiny tail lift; no shaking tree |

Loops must match at endpoints without jumps. **The app owns transitions, interruption and the next state after one-shots.** No embedded dotLottie state machine and no authored bridge segments. Use app-side ease-out transitions of 200–300 ms where motion is permitted; never exceed the project's 300 ms hard cap. The older project brief has a conflicting 400 ms sleep entry; follow the stricter cap.

## Accessibility and acceptance

- Reduced motion and animation-off mean **static poses only**: no ambient animation or animated crossfades. Supply a usable static pose for each semantic state.
- No flashing, strobing, rapid brightness pulses, shaking, fast reversals, continuous rotation, parallax or large bounces. A drawn heart, headlight or star must not become a flashing indicator.
- Idle visible excursion is **at most 2 px at the actual 48 px rendered size**. Verify actual bounds/padding instead of assuming a source-unit conversion. A gentle idle loop may use a 3–4 second period.
- Celebration lasts **0.5–1 second**, uses soft/desaturated accents if any, and never automatically repeats. The app chooses its next state.
- Inspect at **32, 48 and 64 px** on light and dark surfaces. Simplify decorative detail and hide stars as needed. Verify clipping, joints, contact points and face visibility at animation extremes.
- App text and accessible state labels carry meaning; motion/color are supplementary. Hide redundant decorative artwork from assistive technology when the app label already conveys its state.

Confirm that import preserves editable groups. Return the master animation, segment/frame map, static state poses and documented limitations after testing in the app renderer. These files do not install or replace the live pet.

## Visual research references

- [World-Tree Project: the world-tree in literature](https://www.worldtreeproject.org/exhibits/show/yggdrasill/the-world-tree-in-literature): Yggdrasil and the messenger squirrel Ratatoskr.
- [Yggdrasil, Encyclopaedia Britannica 1911 transcription](https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Yggdrasil): three roots and broad world-tree branches.
- [National Museum of Denmark: clothes and jewellery](https://en.natmus.dk/historical-knowledge/denmark/prehistoric-period-until-1050-ad/the-viking-age/the-people/clothes-and-jewellery/): cloak and brooch inspiration.
