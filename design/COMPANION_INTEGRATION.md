# Companion System & Chat — Personal World UI Architecture

**Date:** 2026-09-07
**Status:** Companion system regen + Chat first-class surface — complete
**Source:** Figma file `VATVojyJZT9HKx0CrDS0yr`

## Overview

Personal World has five companion residents — real characters, not placeholders. Each companion maps to a domain/theme context within the product. Chat has been promoted to a first-class product surface alongside Today, World, and Journal.

This document supersedes the earlier Mermaid-centric integration pass.

## Current Residents

| Companion | Role | Strong Contexts | Source Rig |
|---|---|---|---|
| **Mermaid** | Personal companion (the operator Theme) | the operator theme, personal presence, conversation, reassurance | `companions/mermaid/mermaid-source-rig.svg` |
| **Little Helper Robot** | Lab / development / AI helper | Development, automation, Workshop, configuration, tooling | `companions/robot/robot-source-rig.svg` |
| **World-tree Squirrel** | Worlds / lore / memory keeper | VEFR, worlds, lore, memory, journal/history, worldbuilding | `companions/world-tree-squirrel/world-tree-squirrel-source-rig.svg` |
| **Tacos & the Morning Paper** | Journalism / stories / city life | Burrito Journalism, reporting, news, city stories | `companions/taco-news-truck/taco-news-truck-source-rig.svg` |
| **Personal World** | Default system companion | System default, generic theme, product identity | `companions/personal-world/personal-world-source-rig.svg` |

They are siblings in art direction — shared pastel palette, aubergine outlines, friendly rounded forms, rosy cheeks, sparkle decorations — but each has a completely distinct silhouette.

## Companion Architecture

```
Companion System
├── Resident (which character)
│   ├── Mermaid
│   ├── Little Helper Robot
│   ├── World-tree Squirrel
│   ├── Tacos & the Morning Paper
│   └── Personal World
│
├── Size (how large)
│   ├── Micro        16-20px  (nav/header identity, silhouette only)
│   ├── Nav/Sidebar   32px    (persistent sidebar presence)
│   ├── Inline        32-48px (loading, inline context)
│   ├── Empty State   48-64px (empty/comfort presence)
│   ├── Error/Comfort  64px   (error state companion)
│   └── Feature       96px+   (showcase, family portrait — use sparingly)
│
└── Identity Layer
    ├── Personal Companion  (theme-linked or manually selected)
    └── Contextual Character (project/world-linked identity)
```

### Personal vs Contextual Identity

These are separate concepts that can coexist:

- **Personal Companion** — selected by theme or user preference. Persistent across the product.
- **Contextual Character** — associated with the current world/project context.

Example: the operator selects Mermaid as her personal companion. When browsing VEFR, World-tree Squirrel appears as the contextual project identity. They don't both flood the screen — personal companion provides presence, contextual character provides context identity.

## Primary Navigation

Chat is now a first-class destination. The sidebar nav hierarchy is:

```
[p] Appliance Logo
[📅] Today
[💬] Chat          ← NEW: first-class surface
[🌐] World
[📓] Journal
[🧜] Companion     ← context-appropriate companion
[⚙️] Settings
```

## Screen Companion Mapping

| Screen | Companion | Rationale |
|---|---|---|
| `today-hybrid-desktop-1440` | Mermaid (32px) | the operator theme context |
| `today-hybrid-narrow-900` | Mermaid (32px) | the operator theme context |
| `today-state-empty` | Mermaid (48px) | Comfort presence, the operator theme |
| `today-state-loading` | **Robot** (32px) | Non-Mermaid demo — system/tools context |
| `today-state-attention` | Mermaid (32px) | the operator theme context |
| `today-state-partial` | **Personal World** (32px) | Non-Mermaid demo — system default |
| `today-generic-theme` | **Personal World** (32px) | Generic/non-the operator theme |
| `today-rylee-theme` | Mermaid (32px) | the operator's home theme |
| `world-capability-first` | **Personal World** (32px) | System/product context |
| `journal-screen` | **World-tree Squirrel** (32px) | Lore/memory/history context |
| `settings-refined` | **Personal World** (32px) | System settings context |

## Chat Surface

Chat is the conversational doorway into Personal World. It supports asking about and working with Today, journals, worlds, projects, memory/provenance, capabilities, and connected information.

### Chat Screens Produced

| Screen | Description |
|---|---|
| `chat-active-conversation` | Multi-turn desktop conversation with deployment logs, links, structured data |
| `chat-empty-new` | Empty state with Mermaid companion, suggestion chips ("Check on my world", "What happened today?") |
| `chat-thinking-working` | Thinking indicator with text status + capability disclosure ("Checking your connected sources...") |
| `chat-error-partial` | Calm error card with cached data fallback, Retry + Continue actions |
| `chat-contextual-vefr` | VEFR context with Squirrel contextual identity + Mermaid personal companion |
| `chat-tool-capability` | Discovery Feed scan with step-by-step progress indicators |
| `chat-source-provenance` | Inline citation pills + collapsible Sources panel with match percentages |
| `chat-long-dense` | Rich response with heading, prose, YAML code block, bulleted list, summary |
| `chat-narrow-responsive` | 900px responsive layout with collapsed sidebar, full-width composer |

### Chat Design Principles

1. Chat is NOT a modal, sidebar, or utility tucked behind World
2. Chat has sufficient reading width (~640-720px message column)
3. Composer is obvious, accessible, full-width
4. World/project context is always visible in the header
5. Working state uses text status independent of companion animation
6. Provenance/source is available without overwhelming content
7. Error recovery is explicit with clear actions
8. Companion presence is restrained — not a giant talking avatar

## Companion Component Page

The `companion-family-portrait` frame shows all 5 residents together at 96px with:
- Active/Standby state indicators
- Role labels and theme associations
- Personal Companion vs Contextual Character architecture explanation

## Accessibility & Motion

- Companions NEVER carry critical information — semantic state is always in UI text
- `prefers-reduced-motion`: static poses only, no animation
- No flashing, strobing, shaking, rapid pulsing, or repeated large bounce
- Idle motion at 48px: ≤ 2px visible excursion
- Maximum 300ms transitions
- Chat thinking/working state has proper accessible text status independent of mascot animation

## Scale System Reference

| Size | Use | Priority |
|---|---|---|
| Micro (16-20px) | Nav/header identity | Silhouette readability |
| Nav (32px) | Sidebar persistent presence | Character recognition |
| Inline (48px) | Loading, inline context | Detail visibility |
| Empty State (64px) | Empty state comfort | Expression + character |
| Error (64px) | Error state companion | Comfort + recognition |
| Feature (96px+) | Showcase, family portrait | Full detail — use sparingly |

## Asset Files

| Path | Description |
|---|---|
| `design/assets/companions/` | All 5 companion source packages |
| `design/assets/companions/README.md` | Collection overview + download links |
| `design/assets/companions/IMPORT_GUIDE.md` | Figma + LottieFiles import instructions |
| `design/assets/companions/COMPATIBILITY_AUDIT.json` | SVG structure verification |
| `design/assets/mermaid-source-rig-v2.svg` | Polished Mermaid v2 (earlier art direction pass) |
| `design/screens/chat/` | All 9 Chat screen SVG exports |
| `design/screens/` | Updated screen SVG exports with companion system |

## Exported Screens

### Chat (`design/screens/chat/`)
- `chat-active-conversation.svg`
- `chat-empty-new.svg`
- `chat-thinking-working.svg`
- `chat-error-partial.svg`
- `chat-contextual-vefr.svg`
- `chat-tool-capability.svg`
- `chat-source-provenance.svg`
- `chat-long-dense.svg`
- `chat-narrow-responsive.svg`

### Companion System
- `companion-family-portrait.svg`

### Updated Screens (`design/screens/`)
- `today-hybrid-desktop-1440.svg`
- `today-state-empty.svg`
- `today-state-loading.svg`
- `today-state-attention.svg`
- `today-state-partial.svg`
- `world-capability-first.svg`
- `journal-screen.svg`
- `settings-refined.svg`
- `today-hybrid-narrow-900.svg`
- `today-generic-theme.svg`
- `today-rylee-theme.svg`

## What Changed From Previous Pass

1. **Deleted** all old blob/ellipse/placeholder Mermaid artwork from screens
2. **Imported** all 5 approved companion SVG rigs as editable Figma vectors
3. **Placed** correct companion per screen context (not Mermaid everywhere)
4. **Added Chat** to primary navigation across all 11 screens
5. **Created 9 Chat screens** as a first-class product surface
6. **Created companion family portrait** showing all 5 residents with architecture docs
7. **Generic theme proves** the system isn't Mermaid-specific (uses Personal World planet)
8. **Loading state uses Robot** to demonstrate non-Mermaid companions in action
9. **Journal uses Squirrel** for lore/memory context
10. **VEFR Chat uses dual identity** — Mermaid personal + Squirrel contextual
