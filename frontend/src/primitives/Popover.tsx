import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Popover (P1 T7, FOUNDATION-SPEC §5): native popover="auto" where the
 * platform provides it; light-dismiss (click outside) and Escape close;
 * focus returns to the trigger; contents are ≥44px targets.
 *
 * jsdom does not implement the popover attribute or popovertarget
 * activation, so the primitive feature-detects: native popover when
 * available, otherwise an anchored open/close driven by the trigger
 * with equivalent keyboard semantics (same DOM contract, honest in
 * tests). Placement is a simple anchored position class; CSS anchor
 * positioning is deliberately not used (too new).
 */

type Placement = "bottom" | "top";

const POPOVER_SUPPORTED =
  typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

const triggerClasses = cn(
  "inline-flex min-h-[var(--pw-target-minimum)] min-w-[var(--pw-target-minimum)] items-center",
  "justify-center gap-2 rounded-xl border border-[var(--pw-color-border-subtle)]",
  "bg-transparent px-4 text-[var(--pw-color-text-primary)]",
  "hover:border-[var(--pw-color-accent-primary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
);

const panelBase = cn(
  "absolute z-40 rounded-xl border border-[var(--pw-color-border-subtle)]",
  "bg-[var(--pw-color-surface-elevated)] p-[var(--pw-spacing-normal)]",
  "text-[var(--pw-color-text-primary)] shadow-lg"
);

export interface PopoverProps {
  trigger: string;
  children: React.ReactNode;
  placement?: Placement;
}

let popoverSequence = 0;

export function Popover({ trigger, children, placement = "bottom" }: PopoverProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const idRef = React.useRef<string>(null);
  if (idRef.current === null) {
    popoverSequence += 1;
    idRef.current = `pw-popover-${popoverSequence}`;
  }
  const id = idRef.current;

  const closeAndRefocus = React.useCallback(() => {
    setOpen(false);
    // Focus returns to the trigger (A11y §3.6 popover semantics).
    triggerRef.current?.focus();
  }, []);

  // Light dismiss: any pointerdown outside closes (popover="auto" does
  // this natively; the fallback replicates it explicitly).
  React.useEffect(() => {
    if (!open || POPOVER_SUPPORTED) return;
    const onPointerDown = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (!target.closest(`#${id}`)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, id]);

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClasses}
        popoverTarget={POPOVER_SUPPORTED ? id : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            closeAndRefocus();
          }
        }}
      >
        {trigger}
      </button>
      <div
        id={id}
        popover={POPOVER_SUPPORTED ? "auto" : undefined}
        // Always in the DOM for popovertarget; visibility is platform-
        // managed natively, class-managed in the fallback.
        className={cn(
          panelBase,
          placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          "left-0",
          open ? "block" : "hidden"
        )}
        data-pw-popover-open={open ? "true" : "false"}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            closeAndRefocus();
          }
        }}
      >
        {children}
      </div>
    </span>
  );
}