# Personal World — Responsive Rules

---

## Breakpoints

| Name | Range | Layout |
|---|---|---|
| **Desktop** | ≥1200px | Sidebar nav + main + optional detail panel |
| **Compact** | 900–1199px | Narrower sidebar + main |
| **Tablet** | 600–899px | Top nav bar + stacked main |
| **Phone** | <600px | Bottom nav bar + single column |

---

## Navigation

| Viewport | Nav position | Nav style |
|---|---|---|
| Desktop | Left sidebar, 260px | Vertical links + World assistant trigger |
| Compact | Left sidebar, 220px | Same, condensed |
| Tablet | Top bar, full width | Horizontal links + assistant trigger |
| Phone | Bottom bar, full width | Icon tabs + assistant trigger |

### Source Order

Navigation is always before main in DOM source order, regardless of visual position. CSS repositions the bottom bar on phone — the semantic order does not change.

---

## Content Layout

### Desktop / Compact

- Main content fills remaining width
- Detail/provenance panel slides in from right (non-modal)
- Two-column card grids where content allows

### Tablet

- Single column, full width
- Cards stack vertically
- Detail panel becomes a drawer overlay (non-modal)

### Phone

- Single column with generous vertical spacing
- Cards are full-width
- Detail panel becomes a bottom sheet (modal when >50% viewport)
- World assistant becomes modal sheet

---

## World Keeper Companion

| Viewport | Size | Position |
|---|---|---|
| Desktop | 32px | Nav sidebar, near assistant trigger |
| Compact | 32px | Nav sidebar |
| Tablet | 28px | Top nav bar |
| Phone | 28px | Bottom nav bar |

Greeting area companion (Today view):

| Viewport | Size |
|---|---|
| Desktop | 48px |
| Tablet | 40px |
| Phone | 36px |

---

## Touch Targets

Minimum 44×44 CSS px at all breakpoints. Visual elements may be smaller; hit areas may not.

On phone/tablet: respect `env(safe-area-inset-bottom)` for bottom-positioned controls.

---

## Typography Scaling

| Element | Desktop | Tablet | Phone |
|---|---|---|---|
| h1 (greeting) | 32px | 28px | 24px |
| h2 (section) | 20px | 18px | 18px |
| Body | 16px | 16px | 16px |
| Small | 14px | 14px | 14px |
| Caption | 12px | 12px | 12px |

Body text never goes below 16px. Minimum readable size: 12px (captions only). User `text_scale` multiplier applies on top of these base sizes.

---

## Progressive Disclosure Adaptation

| Level | Desktop | Tablet/Phone |
|---|---|---|
| L1 Glance | Inline in row | Inline in row |
| L2 Detail | Expand in-place or side panel | Expand in-place |
| L3 Capability | Side panel | Drawer/sheet |
| L4 Provenance | Side panel tab | Drawer/sheet tab |

---

## Reflow at 200% Zoom

At 200% browser zoom (equivalent to ~640px effective width on a 1280px monitor):

- Layout reflows to single-column (tablet/phone rules apply)
- No horizontal scrollbar on the page level
- No content clipping
- No text truncation without accessible expansion
- Touch targets remain ≥44px

---

## Orientation

No orientation lock. The interface works in both portrait and landscape. Phone landscape uses the tablet layout rules.

---

## Drawer & Sheet Behavior by Viewport

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| Provenance | Right side panel (non-modal) | Drawer overlay (non-modal) | Bottom sheet (modal) |
| World assistant | Right side panel (non-modal) | Right drawer (non-modal) | Bottom sheet (modal) |
| Confirmation | Center dialog (modal) | Center dialog (modal) | Center dialog (modal) |

Modal overlays: focus trapped, Escape closes, explicit close button, background inert.
Non-modal overlays: focus moves in, Escape closes, background interactive.

---

## Grid Behavior

Desktop card grids collapse from multi-column to single-column as viewport narrows:

```
Desktop:     [card] [card] [card]
Compact:     [card] [card]
Tablet:      [card]
Phone:       [card]
```

Cards maintain their minimum comfortable width (280px) and never squeeze horizontally.

---

## Safe Areas

```css
.pw-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.pw-top-bar {
  padding-top: env(safe-area-inset-top, 0px);
}
```

Interactive controls are never placed inside safe area inset zones.
