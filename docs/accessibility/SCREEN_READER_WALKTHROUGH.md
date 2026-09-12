# Project Worlds — Screen Reader Walkthrough

(Formerly "Personal World" — product renamed 2026-09-12; the observed title pattern below reflects the interface as built under the old name.)

This walkthrough describes the current dashboard in `src/personal_world/api.py`
(`_DASHBOARD_HTML` and `syncRoute`), implementation baseline `5017865`.
Labels are source labels, not a transcript of a manual screen-reader test;
announcement wording varies by browser and assistive technology.
The [Accessibility contract](ACCESSIBILITY_CONTRACT.md) remains mandatory.
The [Finish Line](../PERSONAL-WORLD-FINISH-LINE.md) defines target experience,
not a claim that every designed interaction is implemented.

## Entry and landmarks

The first focusable element is **Skip to main content**, linking to
`main#main-content`. Navigation named **Main** precedes the main landmark.
The narrow banner adds a header landmark. An access-code form and status region
appear before main when authentication is needed.

Navigation order is **Today, Chat, World, Journal, Vault, Settings**. The icon
rail names World **Worlds**; the banner link and page heading say **World**.
`syncRoute` sets `aria-current="page"`, updates the document title to
`Personal World — <page>`, and hides inactive views with CSS. It scrolls to the
top but does not explicitly focus the new heading; do not assume an automatic
heading announcement when changing routes.

Desktop uses the rail; 600–899px uses banner links; below 600px the rail becomes
bottom navigation. Hidden navigation copies use `display: none`. Source order
remains navigation before main. See [Responsive rules](RESPONSIVE_RULES.md).
Companion images have empty alt text; the chat companion is also aria-hidden.
There is no separate World Assistant drawer trigger or persistent complementary
landmark in the current dashboard.

## Today

h1 **Today**, date/state text, then:

1. h2 **World health** — summary and explicit status.
2. h2 **Needs attention** — current items or an explicit empty state.
3. h2 **Recent changes** — available recent activity.
4. h2 **Discovery** — configured rollups or unavailable/not-configured state.
5. h2 **Journal** — **Quick journal entry**, **Save entry**, local status,
   **Quick templates** button group (`win:`, `blocker:`, `remember:`),
   h3 **Recent entries**, and **View all**.
6. Native disclosure **More from your world** — expand for h2 **Services**
   (links and Service name/Service URL/Add service controls),
   h2 **Subscription usage**, and h2 **Capabilities**. The capabilities table
   is in a focusable region named **Capabilities table**.

Data depends on the configured world/providers. Calendar/email examples in
older design material are not guaranteed native integrations. Current detail
uses inline `details`/`summary`; attention rows are not universally buttons
opening a provenance drawer.

## Chat

h1 **Chat**, h2 **Talk with your world**, **Conversation details** disclosure,
then the **Conversation** region. Empty-state buttons form the **Conversation
starters** group. The composer has a **Message** textarea and **Send** button.
Enter submits; Shift+Enter inserts a newline. Sending/failure/completion use
text status independent of the companion. Response **Sources** are disclosures.

Chat is read-only conversation over a world snapshot through an optional
reasoning provider. It does not execute model-selected tools or mutate the
world. Contextual chat across sections and cross-system actions are target work.

## Other current pages

| Page | Reading and interaction structure |
|---|---|
| World | h1 World; h2 Intent & policies, Lore, Actors, Lab status, Source repositories, Updates. Actors has a named focusable table region; evidence uses inline disclosure. |
| Journal | h1 Journal; Filter by kind button group (All, Observations, Drift, Failures, Settings) with aria-pressed selection, event list, Load more. Event Source disclosures expose provenance. |
| Vault | h1 Vault; status, Master passphrase and Unlock; unlocked view lists names and offers Secret name/Secret value inputs and Store. Stored values are not redisplayed. Storage inputs currently rely on placeholders; explicit labeling remains an accessibility gap. |
| Settings | h1 Settings; h2 Reading & interaction, Companion & theme, Chat provider, Reminders, Capability & pack settings. The reminder input currently relies on a placeholder. Preference writes are validated and gated; Architecture explains current step-up limits. |

The five-step setup wizard is a separate first-run page, not a main-navigation
destination. Its structure is covered by `tests/test_setup_wizard.py`; this is
not a manual assistive-technology acceptance result.

## Live regions and required restraint

Current markup uses status roles/polite regions for page and chat status and
local save feedback. Message helpers can suppress routine loading announcements;
the conversation region is not itself a live transcript.

Contract section 8 requires meaningful events only, no routine poll/timestamp/
companion announcements, and approximately one announcement per 30 seconds under
normal operation with bursts batched. A polite region alone does not prove a
global throttle or compliance. Manual speech output and cadence remain unverified.

## Target overlays and acceptance requirements

When drawers, contextual chat overlays, or dangerous-action dialogs are added,
Accessibility contract sections 3 and 7 require:

- Non-modal provenance/detail drawers move focus in, close on Escape, restore
  focus to the trigger, and leave the background interactive.
- Modal mobile sheets trap focus, prevent background interaction, provide an
  explicit close control, close on Escape, and restore focus.
- Dangerous confirmations start on the safe/cancel action and explain the
  action and consequence.
- Companion artwork never becomes telemetry or the only path to functionality.

These are requirements, not current overlay implementations. Verify keyboard
operation, heading/source order, accessible names, route focus, and live-region
restraint with actual assistive technology; implementation gaps do not weaken
the accessibility contract.
