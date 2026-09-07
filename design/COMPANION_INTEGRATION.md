# Companion Integration — Mermaid Across Personal World UI

**Date:** 2026-09-07
**Status:** Initial pass complete — mermaid companion added to all sidebar-based screens
**Source:** Figma file `VATVojyJZT9HKx0CrDS0yr`

## Overview

Rylee's Mermaid is the first companion character integrated into the Personal World UI. She serves as the digital resident — a comforting, always-present mascot that lives in the sidebar navigation and appears contextually in empty/loading states.

More companions are coming (Little Helper robot, VEFR Norse squirrel, Tacos & the morning paper truck). The mermaid is Rylee's special companion for Rylee's theme; other companions will map to other themes.

## Placement Rules (from Character Sheet)

| Context | Size | Behavior |
|---|---|---|
| Sidebar (always present) | 32px | Image fill, rounded corners, above settings gear |
| Empty state | 48-56px | Larger vector, beside status text for comfort |
| Loading state | 32px | Sidebar presence, gentle reassurance |
| Header accent | 20px | Beside branding text |
| Footer | inline | Town keeper presence |
| Error pages (404) | 64px | Large companion for error comfort |

### Mascot Rules
1. **Safety & Presence** — Appears everywhere EXCEPT destructive alert dialogs
2. **Non-Obstructive** — Never blocks links, click bounds, or status overlays
3. **Micro-Scaling** — Scales to 16px silhouette with rainbow hair streak for navbars
4. **Always Kind** — Expressions are always gentle, cozy, and reassuring
5. **Workshop Friends** — Coexists with the LRW robot ecosystem
6. **Resident Status** — She is not optional. She is the resident.

## Screens Updated

### Core App Screens (sidebar companion)
- `today-hybrid-desktop-1440` — 32px sidebar + ellipse-based mermaid illustration
- `world-capability-first` — 32px sidebar image
- `journal-screen` — 32px sidebar image
- `settings-refined` — 32px sidebar image
- `today-hybrid-narrow-900` — 32px sidebar image (responsive)

### Today State Variants
- `today-state-empty` — **56px vector mermaid** beside "Your world is ready" (comfort presence)
- `today-state-attention` — 32px sidebar image
- `today-state-partial` — 32px sidebar image
- `today-state-loading` — 32px sidebar + vector detail mermaid

### Theme Screens
- `today-generic-theme` — 32px sidebar image
- `today-rylee-theme` — 32px sidebar image (her home theme!)

### Not Yet Updated (no standard sidebar)
- `capability-disclosure-pattern` — pattern spec, no sidebar
- `auth-error-escalation` — error flow, no sidebar (candidate for 64px error companion)
- `world-assistant-chat` — chat interface, no sidebar (candidate for inline companion)
- `provenance-pattern` — pattern spec, no sidebar

### Intentionally Skipped
- Handoff/spec documents (implementation-handoff-index, accessibility-contract, etc.)
- Reference frames (character sheet, theme pack framework, etc.)
- Superseded screens (section ⑩)

## Companion System Architecture

```
Theme Pack Layer
├── Rylee Theme → Mermaid companion
├── [Future] Theme B → Little Helper robot
├── [Future] Theme C → Norse squirrel + VEFR book tree
└── [Future] Theme D → Tacos & the morning paper

Invariant Core
├── Companion slot in sidebar (32px, above settings)
├── Empty state companion area (48-64px)
├── Loading state companion area (32px)
└── Error state companion area (64px)

User Preferences
├── Companion visibility (on/off per prefers-reduced-motion)
├── Companion selection (theme-linked or manual override)
└── Animation level (idle drift ≤2px, or static)
```

## Asset Files

| File | Description |
|---|---|
| `design/assets/mermaid-source-rig-v2.svg` | Polished animation-ready SVG with all named groups |
| `design/assets/MERMAID_RIG_CHANGES.md` | Detailed change notes from art direction pass |
| `design/LOTTIEFILES_HANDOFF.md` | Animation handoff for LottieFiles |
| `design/assets/mermaid-idle.svg` | Earlier vector attempt (superseded by v2) |

## PNG Previews

PNG screen exports must be uploaded via GitHub web UI (binary files).
Recommended uploads to `design/screens/`:
- `today-hybrid-desktop-1440.png`
- `today-state-empty.png`
- `today-state-loading.png`
- `today-rylee-theme.png`

## Next Steps

1. **Receive final companion vector files** from ChatGPT/team for robot, squirrel, and taco truck
2. **Add companion to non-sidebar screens** (error states, chat interface)
3. **Create companion component** in Figma for instance-based consistency
4. **Wire up theme switching** so companion swaps with theme selection
5. **Animation handoff** for idle sidebar presence (gentle 2px drift per migraine safety rules)
