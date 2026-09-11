import * as React from "react";
import { Dialog } from "./Dialog";
import { ApiError } from "../lib/api";

/**
 * StepUpPrompt (P1 T8, FOUNDATION-SPEC §5 StepUpPrompt row, §1.5):
 *
 * A Dialog preset explaining WHY elevation is needed and naming the
 * action (A11y §4.4 spirit: no vague OK/Yes). P1 is transitional:
 * confirming re-runs the guarded function, which re-sends the request
 * with the step-up header attached — that header attach stays in
 * api.ts's single withStepUp path; this component only orchestrates
 * the UX (403 step_up_required → prompt → confirm → re-run).
 *
 * P2 replaces the confirm body with password/IdP re-auth WITHOUT
 * changing the component API (props stay action/reason/onElevated).
 *
 * Must not store or display credentials; there is no "remember" and
 * nothing to bypass.
 */

export interface StepUpPromptProps {
  /** The action being elevated, named in human terms ("Save preference"). */
  action: string;
  /** Why elevation is needed (honest reason from the host). */
  reason: string;
  /** Called after the user confirms and fn was re-run. */
  onElevated?: () => void;
  /** Test seam: overrides open control (internal state by default). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StepUpPrompt({
  action,
  reason,
  onElevated,
  open: openProp,
  onOpenChange,
}: StepUpPromptProps) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  return (
    <Dialog
      open={open}
      title="Confirm this action"
      description={`${reason} Confirm to continue with: ${action}.`}
      onCancel={() => setOpen(false)}
      onConfirm={() => onElevated?.()}
      confirmLabel="Continue"
    />
  );
}

export interface StepUpController {
  /**
   * Wrap a write-path function. First failure with the 403
   * step_up_required code opens the prompt; if the user confirms, fn is
   * re-run (api.ts's withStepUp path re-sends the step-up header) and
   * the result (or the second failure) resolves as normal.
   */
  withStepUp: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Whether the prompt is currently open (read-only mirror). */
  open: boolean;
}

/**
 * useStepUp(): the host-facing hook. `withStepUp(fn)` catches the typed
 * ApiError 403 step_up_required (T6 api.ts error mapping), opens the
 * StepUpPrompt, and on confirm re-runs fn exactly once.
 */
export function useStepUp(): StepUpController & {
  prompt: React.ReactNode;
} {
  const [pending, setPending] = React.useState<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  } | null>(null);
  const [action, setAction] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const withStepUp = React.useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          error.code === "step_up_required"
        ) {
          return (await new Promise<T>((resolve, reject) => {
            setAction(describeAction(fn));
            setReason(
              error.detail ??
                "This change needs an extra confirmation because it modifies your world."
            );
            setPending({ fn: fn as () => Promise<unknown>, resolve: resolve as (value: unknown) => void, reject });
            setOpen(true);
          })) as T;
        }
        throw error;
      }
    },
    []
  );

  const settle = React.useCallback(
    async (confirmed: boolean) => {
      const entry = pending;
      setPending(null);
      setOpen(false);
      if (!entry) return;
      if (!confirmed) {
        entry.reject(new ApiError(403, "step_up_required", "Step-up cancelled."));
        return;
      }
      try {
        const value = await entry.fn();
        entry.resolve(value);
      } catch (error) {
        entry.reject(error);
      }
    },
    [pending]
  );

  const prompt = (
    <StepUpPrompt
      action={action}
      reason={reason}
      open={open}
      onOpenChange={(next) => {
        if (!next) void settle(false);
      }}
      onElevated={() => void settle(true)}
    />
  );

  return { withStepUp, open, prompt };
}

/** Best-effort human action name from the wrapped function's source. */
function describeAction(fn: () => Promise<unknown>): string {
  const name = fn.name;
  if (name && name !== "anonymous") return name.replace(/^\w/, (c) => c.toUpperCase());
  return "This action";
}