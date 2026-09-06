# Personal World — Screen Reader Walkthrough

**What a non-visual user encounters, in semantic order.**

This walkthrough describes the Today view (primary screen) as experienced through a screen reader. The semantic order is identical at all viewport sizes.

---

## Page Load Announcement

> "Personal World — Today"

---

## 1. Skip Link

> "Skip to main content — link"

First focusable element. Jumps past navigation to `<main>`.

---

## 2. Navigation Landmark

> "Navigation"

### Desktop (sidebar)

| Element | Announcement |
|---|---|
| Link | "Today — current page" |
| Link | "Journal" |
| Link | "Settings" |
| Button | "Open World assistant" |

### Phone (bottom nav)

Same items, same order, bottom-positioned visually but identical in source order.

The World Keeper artwork is `aria-hidden="true"` — the screen reader only encounters "Open World assistant" as a button.

---

## 3. Main Landmark

> "Main"

### 3.1 Greeting (h1)

> "Heading level 1: Good morning"

The greeting text. Time-appropriate. One `h1` per page.

### 3.2 World Summary (h2)

> "Heading level 2: Your world"

A brief status summary of the user's world.

| Element | Announcement |
|---|---|
| Status | "5 capabilities — healthy" |
| Status | "Last refreshed: 2 minutes ago" |

### 3.3 Attention Items (h2)

> "Heading level 2: Needs attention"

Items that warrant user awareness. Each is an interactive row.

| Element | Announcement |
|---|---|
| Row (button) | "GitHub — 3 pull requests need review — needs attention" |
| Row (button) | "Calendar — Meeting in 30 minutes — informational" |

Activating a row opens the detail/provenance drawer.

### 3.4 Recent Changes (h2)

> "Heading level 2: Recent changes"

| Element | Announcement |
|---|---|
| Row | "Email — 4 new messages since 9:00 AM — healthy" |
| Row | "Weather — Rain expected this afternoon — informational" |

### 3.5 Discovery (h2)

> "Heading level 2: Discovery"

Suggestions and surfaced information. Lower priority.

| Element | Announcement |
|---|---|
| Row | "You haven't journaled in 3 days" |
| Row | "New capability available: Pocket integration" |

### 3.6 Journal Quick Entry (h2)

> "Heading level 2: Journal"

| Element | Announcement |
|---|---|
| Text input | "Quick journal entry — edit text" |
| Button | "Save entry" |

### 3.7 Actions (h2)

> "Heading level 2: Actions"

| Element | Announcement |
|---|---|
| Button | "Refresh all capabilities" |
| Button | "View full journal" |

---

## 4. Complementary Landmark

> "Complementary"

Provenance/detail panel (desktop sidebar or drawer).

When a detail row is activated:

| Element | Announcement |
|---|---|
| Heading (h2) | "GitHub — detail" |
| Status | "healthy — Last checked: 1 minute ago" |
| List | "3 pull requests need review" |
| Link | "View in GitHub — external link" |
| Button | "Close detail" |

---

## Drawer Announcements

### Provenance Drawer (non-modal)

> Focus moves to drawer heading. Background remains interactive.

- Escape closes, returns focus to invoking row.
- No focus trap.

### World Assistant (desktop — non-modal)

> "World Assistant — heading level 2"

- Focus moves to input field.
- Escape closes, returns focus to trigger button.

### World Assistant (phone — modal)

> "World Assistant — dialog"

- Focus trapped within dialog.
- Close button available.
- Escape closes.
- Focus returns to trigger.

### Confirmation Dialog (modal)

> "Remove GitHub? — dialog"

- Focus lands on Cancel button (safe action).
- "This will disconnect GitHub from your world."
- Tab order: Cancel → Remove GitHub
- Escape cancels.

---

## Live Region Behavior

The announcement region (`aria-live="polite"`) speaks only for meaningful events:

- "World health changed: 1 capability needs attention"
- "GitHub pull requests updated"
- "Journal entry saved"

It does NOT announce:

- Routine poll refreshes
- Timestamp updates
- Companion state changes
- Background discovery events
- Individual provider observations

Maximum frequency: ~1 announcement per 30 seconds. Bursts batched: "3 capabilities updated."

---

## Heading Map

```
h1  Good morning
  h2  Your world
  h2  Needs attention
  h2  Recent changes
  h2  Discovery
  h2  Journal
  h2  Actions
```

No skipped heading levels. Clean, navigable structure.

---

## Landmark Map

```
navigation    (sidebar or bottom bar)
main          (primary content)
complementary (detail/provenance panel)
```

Three landmarks. Consistent across all viewport sizes.
