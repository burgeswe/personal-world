# Personal World companion source collection

Layered SVG source artwork, static previews and animation handoffs. These are starting rigs, not finished Lottie animations or an installed application change.

| Pet | Source | Handoff |
|---|---|---|
| **Personal World** | [Planet SVG](personal-world/personal-world-source-rig.svg) | [Handoff and ring controls](personal-world/PERSONAL_WORLD_LOTTIEFILES_HANDOFF.md) |
| Mermaid | [SVG](mermaid/mermaid-source-rig.svg) | [Handoff](mermaid/LOTTIEFILES_HANDOFF.md) |
| Little helper robot | [SVG](robot/robot-source-rig.svg) | [Handoff](robot/robot-LOTTIEFILES_HANDOFF.md) |
| VEFR-inspired book tree and Norse squirrel | [SVG](world-tree-squirrel/world-tree-squirrel-source-rig.svg) | [Handoff](world-tree-squirrel/world-tree-squirrel-LOTTIEFILES_HANDOFF.md) |
| Taco truck **and** newspaper stand | [SVG](taco-news-truck/taco-news-truck-source-rig.svg) | [Handoff](taco-news-truck/taco-news-truck-LOTTIEFILES_HANDOFF.md) |

The planet is named **Personal World**; the former `saturn/` source package has moved to `personal-world/`. It has synchronized front/back ring pivot geometry and a [controller mapping](personal-world/personal-world-ring-rig.json). Ring-only tilt poses were rendered; the animator must link the two ring layers to a shared control after import.

The book-tree revision removes the downward center root, makes the squirrel about 16% smaller than its first Norse revision, and adds 24 individually layered open-book leaves. It retains the cloak, cap, brooch and satchel. Fine book-page details are intended for larger sizes and should simplify for compact display.

## Figma and LottieFiles

Start with the [import guide](IMPORT_GUIDE.md) and [source compatibility audit](COMPATIBILITY_AUDIT.json). Every SVG group and drawable shape has a stable unique ID, and shape paint settings are explicit. The cleanup preserves rendered appearance exactly. Native imports and final app playback remain unverified.

## Animation contract

One master with named `idle`, `listening`, `thinking`, `sleep` loops and `hello`, `celebrate` one-shots. App-owned transitions; no embedded state machine. Reduced motion means static poses only. No flashing or continuous spinning, maximum 300 ms transitions, and at most 2 px idle excursion at actual 48 px display size. See each handoff for rig-specific notes.

## Verification

SVG XML and unique group IDs were checked. Static SVGs were rendered and visually inspected; compact-size checks informed the handoff notes. The Personal World ring pivot rebase is pixel-identical at neutral, and −4°/0°/+4° ring-only poses were checked. LottieFiles import, final animation and app playback remain unverified.

## Downloads

- [All five source packages](downloads/personal-world-companion-collection.zip)
- [Robot, book-tree squirrel and taco/newspaper truck](downloads/personal-world-new-pets.zip)
- [Book-tree squirrel only](downloads/vefr-book-tree-squirrel.zip)
- [Personal World planet and ring controls](downloads/personal-world-planet-package.zip)

![Three additional companions](companion-trio-preview.png)
