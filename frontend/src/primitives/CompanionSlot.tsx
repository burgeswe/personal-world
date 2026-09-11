import { cn } from "../lib/utils";
import { useCompanion, COMPANIONS } from "../lib/companion-context";

/**
 * CompanionSlot (P1 T8, FOUNDATION-SPEC §5 owner correction 3, A11y §7):
 *
 * Two SIBLING parts, never nested:
 *   (a) artwork <span aria-hidden="true"><img alt="" …></span> — present
 *       only when the companion pref is on;
 *   (b) when `asAssistantTrigger`, a separate <button> whose ONLY
 *       accessible name is "Open World assistant" — never inside any
 *       aria-hidden subtree, so a companion-off setting removes the
 *       artwork but leaves the assistant fully reachable (A11y §7.4).
 *
 * The slot carries no information, is not focusable itself, and never
 * announces (no live region, no role=status). Poses (P13) stay
 * decorative; `pose` selects the artwork src variant only.
 *
 * Companion identity comes from the `companion` server pref via
 * CompanionProvider (no localStorage truth). Companion "off" is the
 * value "off" (not in the server's EnumPref list, so it can only be
 * reached by hosts that decide to offer it); the artwork part renders
 * nothing in that state, the trigger remains.
 */

export type CompanionSize = "micro" | "nav" | "inline" | "empty" | "error";

/**
 * Size mapping source: design/COMPANION_INTEGRATION.md "Scale System
 * Reference" (Micro 16-20px, Nav 32px, Inline 32-48px, Empty 48-64px,
 * Error 64px). Rendered dimensions come from the CSS classes; these
 * px sizes are the design contract the classes express.
 */
export const COMPANION_SIZES: Record<CompanionSize, { px: number; label: string }> = {
  micro: { px: 18, label: "Micro (nav/header identity)" },
  nav: { px: 32, label: "Nav (sidebar presence)" },
  inline: { px: 48, label: "Inline (loading/inline context)" },
  empty: { px: 64, label: "Empty state (comfort presence)" },
  error: { px: 64, label: "Error (comfort presence)" },
};

export const ASSISTANT_TRIGGER_LABEL = "Open World assistant";

export interface CompanionSlotProps {
  size: CompanionSize;
  /** Artwork pose variant (P13 poses); selects the src suffix. */
  pose?: string;
  asAssistantTrigger?: boolean;
  onOpenAssistant?: () => void;
  /** Test/SSR seam: overrides the pref read (defaults to context). */
  companion?: string | null;
}

export function CompanionSlot({
  size,
  pose,
  asAssistantTrigger = false,
  onOpenAssistant,
  companion: companionOverride,
}: CompanionSlotProps) {
  const context = useCompanion();
  const companion = companionOverride !== undefined ? companionOverride : context.companion;
  const artworkVisible = companion !== "off" && companion !== null;
  const dimensions = COMPANION_SIZES[size];

  // Artwork src: the canonical /companions/<companion>.svg route served
  // by the backend (api.py companion_svg); pose variants append the
  // pose name (P13 artwork; until then only the base file exists).
  const baseName = companion && COMPANIONS[companion] ? companion : "personal-world";
  const src = pose
    ? `/companions/${baseName}-${pose}.svg`
    : `/companions/${baseName}.svg`;

  return (
    <span
      data-pw-companion-slot=""
      data-pw-companion={artworkVisible ? baseName : "off"}
      className="inline-flex items-center"
    >
      {/* Part (a): decorative artwork. aria-hidden subtree — the img is
          inside it with alt=""; removed entirely when companion is off. */}
      {artworkVisible ? (
        <span aria-hidden="true" className="inline-flex">
          <img
            src={src}
            alt=""
            width={dimensions.px}
            height={dimensions.px}
            className="block"
          />
        </span>
      ) : null}
      {/* Part (b): the assistant trigger — a SIBLING of the artwork,
          never inside the aria-hidden subtree. Its ONLY accessible name
          is "Open World assistant" (A11y §7.2/7.3). */}
      {asAssistantTrigger ? (
        <button
          type="button"
          aria-label={ASSISTANT_TRIGGER_LABEL}
          onClick={onOpenAssistant}
          className={cn(
            "inline-flex min-h-[var(--pw-target-minimum)] min-w-[var(--pw-target-minimum)]",
            "items-center justify-center rounded-xl border border-transparent",
            "text-transparent",
            "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
            artworkVisible && "ml-[var(--pw-spacing-compact)]"
          )}
        >
          <span aria-hidden="true" className="text-[var(--pw-color-text-secondary)]">
            ✚
          </span>
        </button>
      ) : null}
    </span>
  );
}