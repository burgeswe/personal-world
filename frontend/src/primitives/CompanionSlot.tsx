import { cn } from "../lib/utils";
import { useCompanion, COMPANIONS } from "../lib/companion-context";

/**
 * CompanionSlot (P1 T8, FOUNDATION-SPEC §5 owner correction 3, A11y §7):
 *
 * Without the trigger, the slot is one sibling part: artwork
 * <span aria-hidden="true"><img alt="" …></span> — present only when
 * the companion pref is on.
 *
 * With `asAssistantTrigger`, the trigger is a labeled affordance
 * (finding C, T14 human-gate polish): the companion artwork + the
 * visible "Ask your world" label both live INSIDE the button as
 * aria-hidden decoration (A11y §7.2 allows the artwork to accompany or
 * contain the trigger while artwork stays hidden; the trigger itself
 * is never inside an aria-hidden subtree and its ONLY accessible name
 * is "Open World assistant"). No sibling artwork is rendered beside a
 * trigger, so the shell shows exactly ONE companion (finding D). A
 * companion-off setting removes the artwork but leaves the visible
 * label and full reachability (A11y §7.4).
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

/** Visible affordance text (finding C): a bare "+" was too ambiguous
 * for the PRIMARY interaction model. The label is decorative under the
 * §7.2 sibling contract — aria-hidden so the accessible name stays
 * EXACTLY "Open World assistant"; the artwork beside it is the same
 * aria-hidden pattern. Calm styling: secondary text, primary on hover,
 * no motion. */
export const ASSISTANT_TRIGGER_VISIBLE_LABEL = "Ask your world";

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
      {/* Part (a): decorative artwork, ONLY when the slot is not the
          assistant trigger (the trigger carries its own artwork inside
          the button — finding C; one companion in the shell — finding
          D). aria-hidden subtree, img alt=""; removed when companion
          is off. */}
      {artworkVisible && !asAssistantTrigger ? (
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
      {/* Part (b): the assistant trigger — a labeled affordance whose
          artwork + visible label are aria-hidden decoration INSIDE the
          button. The button itself is never inside an aria-hidden
          subtree and its ONLY accessible name is "Open World
          assistant" (A11y §7.2/7.3). */}
      {asAssistantTrigger ? (
        <button
          type="button"
          aria-label={ASSISTANT_TRIGGER_LABEL}
          onClick={onOpenAssistant}
          className={cn(
            "inline-flex min-h-[var(--pw-target-minimum)] min-w-[var(--pw-target-minimum)]",
            "items-center justify-center gap-[var(--pw-spacing-compact)] rounded-xl border border-transparent",
            "px-[var(--pw-spacing-normal)]",
            "text-[var(--pw-color-text-secondary)] hover:text-[var(--pw-color-text-primary)]",
            "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
          )}
        >
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
          <span aria-hidden="true" className="text-[0.8rem] leading-tight whitespace-nowrap">
            {ASSISTANT_TRIGGER_VISIBLE_LABEL}
          </span>
        </button>
      ) : null}
    </span>
  );
}