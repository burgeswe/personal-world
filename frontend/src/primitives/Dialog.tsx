import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Dialog (P1 T7, FOUNDATION-SPEC §5): native <dialog> via showModal().
 *
 * Platform focus trap; initial focus on the SAFE action (default Cancel);
 * Escape = cancel; explicit close button named "Close <title>";
 * aria-labelledby = title h2, aria-describedby = body; focus returns to
 * the invoker on close; background inert (dialog showModal() does this
 * natively via the top layer — the fallback path sets inert explicitly).
 *
 * danger variant: confirm label is the verb, body names consequence and
 * provider (A11y §4.4). The destructive action is never auto-focused.
 *
 * jsdom (test env) does not implement showModal/close/inert; a
 * feature-detected fallback renders the same <dialog> as a centered
 * overlay with manual inert handling so tests stay honest (console
 * notes the degradation once).
 */

let warnedFallback = false;

function nativeModalAvailable(): boolean {
  return (
    typeof HTMLDialogElement !== "undefined" &&
    typeof HTMLDialogElement.prototype.showModal === "function" &&
    typeof HTMLDialogElement.prototype.close === "function"
  );
}

export interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel: string;
  danger?: boolean;
  initialFocus?: "cancel" | "confirm";
  children?: React.ReactNode;
}

const panelClasses = cn(
  "w-full max-w-md rounded-xl border border-[var(--pw-color-border-subtle)]",
  "bg-[var(--pw-color-surface-elevated)] p-[var(--pw-spacing-loose)]",
  "text-[var(--pw-color-text-primary)] shadow-lg"
);

const buttonClasses = cn(
  "inline-flex min-h-[var(--pw-target-minimum)] items-center justify-center",
  "gap-2 rounded-xl px-5 font-medium",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
);

const cancelButtonClasses = cn(
  buttonClasses,
  "border border-[var(--pw-color-border-subtle)] bg-transparent",
  "text-[var(--pw-color-text-primary)]",
  "hover:border-[var(--pw-color-accent-primary)]"
);

const confirmButtonClasses = cn(
  buttonClasses,
  "bg-[var(--pw-color-accent-primary)] text-[var(--pw-color-surface-canvas)]",
  "hover:opacity-90"
);

const dangerConfirmButtonClasses = cn(
  buttonClasses,
  "bg-[var(--pw-color-accent-secondary)] text-[var(--pw-color-surface-canvas)]",
  "hover:opacity-90"
);

const closeButtonClasses = cn(
  buttonClasses,
  "absolute right-[var(--pw-spacing-normal)] top-[var(--pw-spacing-normal)]",
  "min-w-[var(--pw-target-minimum)] border border-transparent bg-transparent",
  "text-[var(--pw-color-text-secondary)] hover:text-[var(--pw-color-text-primary)]"
);

export function Dialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  danger = false,
  initialFocus = "cancel",
  children,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const invokerRef = React.useRef<Element | null>(null);
  const nativeModal = React.useRef<boolean>(nativeModalAvailable());

  const cancel = React.useCallback(() => {
    onCancel();
  }, [onCancel]);

  // Open/close side effects: remember invoker, manage the element, move focus.
  // The <dialog> element stays mounted (native dialog semantics: [open]
  // toggles), so this effect always sees the element.
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!invokerRef.current) invokerRef.current = document.activeElement;
      if (nativeModal.current) {
        if (!dialog.open) dialog.showModal();
      } else {
        if (!warnedFallback) {
          warnedFallback = true;
          console.warn(
            "Dialog: HTMLDialogElement.showModal unavailable; " +
              "using feature-detected overlay fallback (non-native environment)."
          );
        }
        dialog.setAttribute("open", "");
        // Background inert: the dialog must be OUTSIDE the inerted subtree,
        // so inert the rest of the body, not the dialog's ancestors here.
        document.body.childNodes.forEach((node) => {
          if (
            node instanceof HTMLElement &&
            node !== dialog &&
            !dialog.contains(node)
          ) {
            node.setAttribute("inert", "");
          }
        });
      }
      const focusTarget =
        initialFocus === "confirm" && confirmRef.current
          ? confirmRef.current
          : cancelRef.current;
      focusElement(focusTarget);
    } else {
      if (nativeModal.current) {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute("open");
        document.body.childNodes.forEach((node) => {
          if (node instanceof HTMLElement) node.removeAttribute("inert");
        });
      }
      // Focus returns to the invoker (A11y §3.3). Inert is removed
      // first so the restored target is actually focusable.
      const invoker = invokerRef.current;
      invokerRef.current = null;
      if (
        invoker instanceof HTMLElement &&
        document.contains(invoker) &&
        !invoker.hasAttribute("inert") &&
        !invoker.closest("[inert]")
      ) {
        focusElement(invoker);
      }
    }
  }, [open, initialFocus]);

  // Escape = cancel (the cancel event covers native; keydown covers fallback).
  React.useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    dialog.addEventListener("keydown", onKey);
    const onCancelEvent = (event: Event) => {
      event.preventDefault();
      cancel();
    };
    dialog.addEventListener("cancel", onCancelEvent);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("cancel", onCancelEvent);
    };
  }, [open, cancel]);

  // Unmount cleanup: close + restore, even if the parent forgot.
  React.useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (!dialog) return;
      document.body.childNodes.forEach((node) => {
        if (node instanceof HTMLElement) node.removeAttribute("inert");
      });
      if (nativeModal.current && dialog.open) dialog.close();
    };
  }, []);

  const describedById = description ? "pw-dialog-description" : undefined;

  return (
    <dialog
      ref={dialogRef}
      open={open}
      aria-labelledby="pw-dialog-title"
      aria-describedby={describedById}
      className={cn(
        panelClasses,
        "m-auto",
        !open && "hidden",
        !nativeModal.current && open &&
          "fixed inset-0 max-h-[calc(100vh-2*var(--pw-spacing-loose))] bg-[var(--pw-color-surface-elevated)]"
      )}
      data-pw-dialog={danger ? "danger" : "confirm"}
    >
      {!nativeModal.current && (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 bg-[color-mix(in_srgb,var(--pw-color-surface-canvas)_75%,transparent)]"
        />
      )}
      <button
        type="button"
        className={closeButtonClasses}
        onClick={cancel}
        aria-label={`Close ${title}`}
      >
        ✕
      </button>
      <h2
        id="pw-dialog-title"
        className="pr-[calc(2*var(--pw-target-minimum))] text-lg font-semibold"
      >
        {title}
      </h2>
      {description ? (
        <p
          id="pw-dialog-description"
          className="mt-[var(--pw-spacing-normal)] text-[var(--pw-color-text-secondary)]"
        >
          {description}
        </p>
      ) : null}
      {children ? (
        <div className="mt-[var(--pw-spacing-normal)]">{children}</div>
      ) : null}
      <div className="mt-[var(--pw-spacing-loose)] flex gap-[var(--pw-spacing-normal)]">
        <button
          ref={cancelRef}
          type="button"
          className={cancelButtonClasses}
          onClick={cancel}
        >
          Cancel
        </button>
        {onConfirm ? (
          <button
            ref={confirmRef}
            type="button"
            className={cn(
              danger ? dangerConfirmButtonClasses : confirmButtonClasses
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}

function focusElement(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.focus();
  } catch {
    // element not focusable in this environment; platform focus stays put
  }
}