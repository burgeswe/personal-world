# Personal World — Responsive Rules

Current behavior is grounded in `_DASHBOARD_HTML` in
`src/personal_world/api.py`, implementation baseline `5017865`.
The [Accessibility contract](ACCESSIBILITY_CONTRACT.md) governs every viewport.
Design requirements below are distinguished from implemented layout rules.

## Current breakpoints and navigation

| Effective CSS viewport | Implemented behavior |
|---|---|
| ≥900px | Fixed left icon rail, `--rail-width: 72px`; matching main-wrapper left margin. Banner hidden. No separate 1200px breakpoint. |
| 600–899px | `@media (max-width: 899px)` hides `.rail-only`, shows the top banner with horizontal links, removes the left margin, and stacks the shell. |
| ≤599px | The later `@media (max-width: 599px)` re-enables `.rail.rail-only` as fixed bottom navigation and hides banner navigation links. Banner branding remains. |

The under-900px rule is not the full cascade: **phone bottom navigation is
implemented** by the later rule. Navigation is Today, Chat, World, Journal,
Vault, Settings. The rail labels World as Worlds. Navigation remains before
main in DOM order even when visually at the bottom. Hidden copies use
`display: none`.

Phone navigation reserves 60px plus the bottom safe-area inset. With 56px
targets it becomes a three-column grid and reserves 128px plus the inset.
Main-wrapper bottom padding matches; the sticky chat composer is offset above
navigation (61px or 129px plus the inset). Verify narrow widths with larger
target and text preferences.

## Current content and typography

Main padding is `1.5rem 1rem 2rem` below 900px and `1rem 0.75rem 2rem` below
600px. Chat messages may use full width on phone. Tables use explicit scroll
regions. Progressive disclosure uses native inline `details`/`summary`, including
Today’s More from your world. There is no viewport-specific provenance drawer
or World Assistant sheet implemented.

Source defines display headings at `2.5rem`, section headings at `1.375rem`,
and body at `calc(1rem * var(--pw-text-scale, 1))`; the older proposed per-device
typography table is not current CSS. Brand companions are 32px and chat companions
48px, without the older proposed 28/36/40px viewport variants.

## Accessibility requirements

- Minimum 44×44 CSS px interactive targets at every breakpoint; larger
  preferences remain usable. Focus stays visible and DOM order stays logical.
- Browser zoom/text scaling remain available. At 200% zoom, reflow must avoid
  page-level horizontal scrolling, clipping, and inaccessible truncation.
  `overflow-x: hidden` alone does not prove successful reflow.
- No orientation lock: effective viewport width selects the layout.
- Safe areas protect controls. Phone navigation currently uses bottom/left/right
  insets; remaining surfaces still need verification against the contract.
- Motion defaults to `reduced`. OS `prefers-reduced-motion: reduce`
  unconditionally disables animations/transitions in current CSS.

## Target guidance, not shipped overlays

The [Finish Line](../PERSONAL-WORLD-FINISH-LINE.md) calls for contextual chat
and configurable sections. It does not require retaining a standalone Chat
destination or the current breakpoint design forever.

Future drawers and sheets must follow Accessibility contract section 3:
non-modal drawers move/restore focus and leave background interaction available;
modal sheets trap focus, prevent background interaction, offer explicit close,
close on Escape, and restore focus. Dangerous confirmations start on the safe
action. These patterns must not be labeled implemented before verification.

## Verification scope

`tests/test_dashboard.py` checks source structure/styles and accessibility
invariants. Browser acceptance should cover keyboard use, 200% zoom, safe areas,
44/48/56px targets, text scaling, and composer overlap at 599/600 and 899/900px.
Source/test evidence is not a manual screen-reader or device acceptance result.
