# LottieFiles Creator — Production Lessons

> Durable lessons from building the Project Worlds Mermaid companion animation.
> Keep this document as the starting checklist for future animated companion work.

## Why this exists

The Mermaid animation was completed successfully, but the process exposed several
mechanical limitations in the Figma/SVG → LottieFiles Creator workflow.

These lessons should be applied **before animation work begins** on the next
Project Worlds companion.

---

## 1. Test import fidelity first

Do not assume named Figma or SVG groups will survive import into LottieFiles Creator.

The Mermaid source contained 53+ named parts, including elements such as:

- `hair-front`
- `eyes-open`
- `eyes-closed`
- `mouth-smile`
- `mouth-neutral`
- arms
- tail pieces
- bubbles/sparkles

Direct SVG import into Creator collapsed the artwork into a single flat layer.
`break_scene_layer` did not recover the original child structure.

### Rule

Before doing any animation work:

1. Import the source.
2. Inspect the resulting layer hierarchy.
3. Verify that the required independently animated parts actually exist.
4. Do not begin keyframing until this gate passes.

If the import is flattened, stop immediately and use an adapter-pack workflow.

---

## 2. Prefer a validated adapter pack when imports flatten

For the Mermaid, the successful workaround was a set of independent,
full-canvas SVG parts sharing the same coordinate system.

The adapter pack contained 16 independently controllable layers:

1. `hair-back`
2. `hair-front`
3. `face-head`
4. `eyes-open`
5. `eyes-closed`
6. `mouth-smile`
7. `mouth-neutral`
8. `cheeks`
9. `body-torso`
10. `shell-top`
11. `arm-left`
12. `arm-right`
13. `tail`
14. `tail-fin-left`
15. `tail-fin-right`
16. `bubbles-sparkles`

Each SVG retained the full 512×512 canvas/viewBox rather than being cropped to
the individual part.

This preserved common coordinates and made reconstruction deterministic.

### Rule

If direct import flattens:

**Do not rebuild animation geometry by eye.**

Generate a deterministic adapter pack from the canonical source instead.

Validate that:

- every intended drawing element appears exactly once;
- painter order is documented;
- dimensions and viewBox are identical;
- alternate/hidden variants work independently;
- reconstructed artwork matches the canonical source;
- canonical source geometry and colors remain untouched.

---

## 3. Define the entire timeline before keyframing

Large multi-state animations have substantial surface area for silent mistakes.

The Mermaid master used:

- 30 fps
- 498 frames
- 6 semantic states

Final timeline:

| State | Frames | Behavior |
|---|---:|---|
| idle | 0–90 | loop |
| hello | 96–141 | one-shot |
| listening | 147–222 | loop |
| thinking | 228–318 | loop |
| celebrate | 324–369 | one-shot |
| sleep | 375–495 | loop |

The six-frame gaps are intentional boundary padding.

### Rule

Before writing keyframes, establish:

- frame rate;
- total frame budget;
- every semantic state;
- exact start/end frame;
- loop vs one-shot behavior;
- transition/boundary padding;
- representative static frame;
- motion limits.

Plan the complete timeline once rather than extending it piecemeal.

---

## 4. Declare structural relationships explicitly

Some layers must behave as a visual unit.

Examples include:

- hand ↔ arm
- face ↔ hair
- torso ↔ shell
- tail ↔ fins

These relationships should be treated as animation constraints, not discovered
during final QA.

### Rule

For every animation, identify linked layers before keyframing and specify their
allowed relative movement.

For the Mermaid, adjacent/jointed parts were kept within approximately 2 px per
beat so joints did not visually separate.

---

## 5. Use restrained transforms

The Mermaid succeeded without modifying canonical artwork.

Animation used primarily:

- position transforms;
- opacity/visibility switching.

Avoid unnecessary:

- path morphing;
- anchor-point manipulation;
- scale distortion;
- filters;
- masks;
- effects;
- geometry edits.

Creator's anchor-point tooling proved particularly risky because imported artwork
bounds were not reliably available. Attempts to compensate anchors could move
parts off-canvas.

### Rule

Prefer the simplest transform capable of expressing the state.

Do not use anchor-point surgery merely to make an animation mechanically
"prettier."

Visual correctness at the actual rendered size matters more than editor-space
perfection.

---

## 6. Static poses are part of the specification

Every semantic state must communicate meaning even when motion is unavailable.

Mermaid representative frames:

| State | Static frame |
|---|---:|
| idle | 0 |
| hello | 104 |
| listening | 184 |
| thinking | 273 |
| celebrate | 338 |
| sleep | 435 |

These frames should remain recognizable under reduced-motion/static rendering.

### Rule

Every state gets a designated static representative frame.

A state does not pass merely because its animation looks good.

---

## 7. Build acceptance gates before declaring completion

The most important process safeguard was separating:

**construction → inspection → acceptance**

Do not continuously tweak an animation merely because further changes are
possible.

Once construction passes mechanical checks, freeze it pending render QA.

For the Mermaid, final render QA requires inspection at:

- 32 px / light
- 32 px / dark
- 48 px / light
- 48 px / dark
- 64 px / light
- 64 px / dark

Inspect:

- silhouette/readability;
- outline shimmer;
- detail noise;
- clipping;
- exposed joints;
- state distinguishability;
- closed-eye readability;
- frozen hello readability;
- frozen celebrate readability.

### Rule

Do not retune before reviewing actual target-size renders.

Make evidence-based corrections only.

---

## 8. Verify loop mechanics explicitly

For looping states, the first and last frames must match exactly.

Mermaid verified:

- frame 0 = frame 90
- frame 147 = frame 222
- frame 228 = frame 318
- frame 375 = frame 495

### Rule

Endpoint equality is an acceptance test, not a visual assumption.

One-shot animations should also explicitly return to their intended resting
state where appropriate.

---

## 9. Accessibility limits belong in the animation contract

Motion constraints should be defined before animation begins.

For Mermaid idle:

- master excursion: 14 px on a 512 px canvas
- at 32 px: ~0.88 px
- at 48 px: ~1.31 px
- at 64 px: ~1.75 px

This remained under the 2 px visible-excursion target at the intended UI sizes.

The animation also avoided:

- flashing;
- strobing;
- shaking;
- unnecessary rotation;
- parallax.

Static/reduced-motion alternatives remain mandatory.

---

## 10. Application owns semantic state

The Lottie artifact is an animation resource, not the application's behavioral
state machine.

The Mermaid master contains the semantic timeline and markers, but Personal
World owns:

- state selection;
- transitions;
- timing;
- user preferences;
- reduced-motion behavior;
- contextual companion behavior.

### Rule

Do not bury application logic inside the animation file unless there is a
specific architectural reason to do so.

---

# Future Companion Preflight

Before animating the next Project Worlds resident:

- [ ] Canonical source identified and immutable
- [ ] Direct import tested
- [ ] Layer hierarchy inspected
- [ ] Adapter pack created immediately if import flattens
- [ ] Painter order documented
- [ ] Reconstruction validated against canonical artwork
- [ ] Full timeline/state/frame budget defined
- [ ] Loop vs one-shot behavior defined
- [ ] Representative static frames defined
- [ ] Linked-layer constraints documented
- [ ] Motion/accessibility limits defined
- [ ] Reduced-motion/static behavior defined
- [ ] Animation constructed
- [ ] Loop endpoint equality verified
- [ ] Structural/joint integrity verified
- [ ] Target-size light/dark renders reviewed
- [ ] Only evidence-based corrections made
- [ ] Exported artifact validated
- [ ] Application remains owner of semantic state

---

## Core production principle

**Test the pipeline before animating the artwork.**

If the import fails structurally, fix the representation rather than fighting
the animation tool.

And for large multi-state animations:

**plan once, construct deliberately, inspect, freeze, then QA.**

Do not spend 500 frames discovering that the mermaid became one layer.
