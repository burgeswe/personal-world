import * as React from "react";
import { cn } from "../lib/utils";
import { Dialog } from "./Dialog";

/**
 * Drawer (P1 T8, FOUNDATION-SPEC §5, A11y §3.1/3.2/3.4/3.5):
 *
 * Desktop (≥600px): NON-MODAL <aside role="complementary">. Focus moves
 * to the heading on open; Escape closes and focus returns to the
 * trigger; the background stays fully interactive — NO focus trap, and
 * a content refresh (children swap while open) never steals focus.
 *
 * Below 600px (A11y §3.5): a MODAL bottom sheet composing the T7
 * Dialog — platform focus trap, explicit close, Escape dismisses,
 * focus returns to the trigger. The switch is CSS/viewport truth; the
 * component feature-detects matchMedia (jsdom has none and stays
 * desktop non-modal), so the sheet path is exercised through the
 * `data-pw-drawer-sheet` seam (honest seam test).
 *
 * Hosts provenance/detail and the World Assistant (the host supplies
 * the title, "World Assistant" for the assistant). The primitive never
 * announces; companion state cannot reach a live region from here.
 */

export type DrawerSide = "right" | "bottom";

export interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  side: DrawerSide;
  children?: React.ReactNode;
}

const BREAKPOINT_QUERY = "(max-width: 599px)";

function queryMatches(query: string): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

/** Test seam: does this environment's CSS/viewport select the sheet? */
export function preferSheetViewport(): boolean {
  return queryMatches(BREAKPOINT_QUERY);
}

let drawerSequence = 0;

export function Drawer({ open, title, onClose, side, children }: DrawerProps) {
  const [sheet, setSheet] = React.useState<boolean>(() => preferSheetViewport());
  const headingIdRef = React.useRef<string | null>(null);
  if (headingIdRef.current === null) {
    drawerSequence += 1;
    headingIdRef.current = `pw-drawer-title-${drawerSequence}`;
  }
  const headingId = headingIdRef.current;
  const prevOpenRef = React.useRef(false);

  // Viewport class is CSS truth; the JS side only mirrors it for the
  // sheet seam. jsdom (no matchMedia) stays desktop non-modal.
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(BREAKPOINT_QUERY);
    const onChange = () => setSheet(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const sheetMode = sheet && side === "bottom";

  // Desktop open/close focus management. Effects run on `open`
  // TRANSITIONS only: a content refresh (children swap while open)
  // re-renders but leaves `open` true, so focus is never stolen.
  React.useEffect(() => {
    if (sheetMode) return;
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (open === wasOpen) return;
    if (open) {
      const invoker = document.activeElement;
      document.getElementById(headingId)?.focus();
      // Remember the trigger for restore only if focus actually moved.
      lastInvoker = invoker instanceof HTMLElement ? invoker : null;
    } else {
      restoreFocusToInvoker();
    }
  }, [open, sheetMode, headingId]);

  // Desktop Escape closes (background stays interactive, so Escape is
  // handled at document level; the sheet path gets Escape from Dialog).
  React.useEffect(() => {
    if (!open || sheetMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, sheetMode, onClose]);

  if (sheetMode) {
    return (
      <div data-pw-drawer-sheet="true">
        <Dialog open={open} title={title} onCancel={onClose} confirmLabel="Close">
          <div className="max-h-[50vh] overflow-y-auto">{children}</div>
        </Dialog>
      </div>
    );
  }

  return (
    <aside
      role="complementary"
      aria-labelledby={headingId}
      data-pw-drawer={side}
      data-pw-drawer-open={open ? "true" : "false"}
      className={cn(
        "flex flex-col border-[var(--pw-color-border-subtle)]",
        "bg-[var(--pw-color-surface-panel)] text-[var(--pw-color-text-primary)]",
        side === "right" &&
          "fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l shadow-lg",
        side === "bottom" && "fixed inset-x-0 bottom-0 z-40 border-t shadow-lg",
        !open && "hidden"
      )}
    >
      <div className="flex items-start justify-between gap-[var(--pw-spacing-normal)] p-[var(--pw-spacing-loose)] pb-0">
        <h2
          id={headingId}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className={cn(
            "inline-flex min-h-[var(--pw-target-minimum)] min-w-[var(--pw-target-minimum)]",
            "items-center justify-center rounded-xl text-[var(--pw-color-text-secondary)]",
            "hover:text-[var(--pw-color-text-primary)]",
            "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
          )}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-[var(--pw-spacing-loose)] pt-[var(--pw-spacing-normal)]">
        {children}
      </div>
    </aside>
  );
}

// ── Invoker tracking (module scope: survives re-renders and portals) ──

let lastInvoker: HTMLElement | null = null;

function restoreFocusToInvoker() {
  const invoker = lastInvoker;
  lastInvoker = null;
  if (
    invoker &&
    document.contains(invoker) &&
    !invoker.hasAttribute("inert") &&
    !invoker.closest("[inert]")
  ) {
    try {
      invoker.focus();
    } catch {
      // not focusable in this environment; platform focus stays put
    }
  }
}