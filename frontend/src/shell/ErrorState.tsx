import { cn } from "../lib/utils";

/**
 * ErrorState (P1 T9, FOUNDATION-SPEC §5 shell, A11y §4.5): the honest
 * error placeholder. Names WHAT FAILED (the request that could not be
 * completed) and WHAT STILL WORKS (the rest of the person's world —
 * navigation, other sections, retry).
 */

export interface ErrorStateProps {
  /** The section this error belongs to ("Today"). */
  title: string;
  /** What failed, named specifically ("could not load your journal"). */
  failed: string;
  /** Server-provided detail, when one exists (never fabricated). */
  detail?: string | null;
  /** Called to retry the failed request. */
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  failed,
  detail = null,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <section
      className={cn("pw-state", className)}
      data-pw-state="error"
      aria-labelledby="pw-state-title"
    >
      <h2 id="pw-state-title">{title}</h2>
      <p className="pw-state-summary">
        {failed}
        {detail ? <> — <span className="pw-state-detail-inline">{detail}</span></> : null}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="pw-state-retry">
          Try again
        </button>
      ) : null}
      <p className="pw-state-detail">
        The rest of your world still works: every section in Main stays
        available while this one is failing.
      </p>
    </section>
  );
}