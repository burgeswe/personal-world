import { cn } from "../lib/utils";
import { StatusChip } from "../primitives/StatusChip";
import { CompanionSlot } from "../primitives/CompanionSlot";
import type { CanonicalStatus } from "../primitives/StatusChip";

/**
 * EmptyState (P1 T9, FOUNDATION-SPEC §5 shell): the honest placeholder
 * for a section whose capability is not wired up (status
 * "not_configured"/"disabled") or is unhealthy (e.g. "unavailable").
 *
 * Contract:
 * - names the CAPABILITY in plain human terms;
 * - names the CONFIGURATION KNOB (the preference/connection surface the
 *   person controls — normally Settings, or a named server setting);
 * - NEVER names a mount path, module, env var beyond the documented
 *   server-side knob, or anything implementation-internal.
 *
 * Attention order (principle 2; finding E): heading → status chip →
 * capability → knob (What / Why / Next), then the companion comfort
 * presence (T14 human gate 4, COMPANION_INTEGRATION "Empty State
 * (64px) — empty/comfort presence", the contract's #1 use) —
 * decorative aria-hidden artwork only (A11y §7.1), never a status
 * signal, never animated. Companion "off" removes the artwork; the
 * honest copy is the whole state either way. Geometry stays
 * proportionate: .pw-state is a 34rem card inside the shell measure.
 *
 * `status` is passed straight through StatusChip, so it must be a
 * canonical status.py value or null (no invented statuses).
 */

export interface EmptyStateProps {
  /** The section/capability this screen belongs to ("Interests"). */
  title: string;
  /** What the person wants to do here, in one sentence. */
  capability: string;
  /** The knob that turns this on, in plain terms. */
  knob: string;
  /** Canonical status from status.py, or null when not yet known. */
  status?: CanonicalStatus | null;
  className?: string;
}

export function EmptyState({ title, capability, knob, status = null, className }: EmptyStateProps) {
  return (
    <section
      className={cn("pw-state", className)}
      data-pw-state="empty"
      aria-labelledby="pw-state-title"
    >
      {/* What/Why/Next attention order (principle 2; finding E): the
          status chip names WHAT (the honest state), the capability
          sentence names WHY it matters, the knob names WHAT to do
          next. Chip sits with the capability sentence as one flow;
          the knob is the closing next-action line. */}
      <h2 id="pw-state-title">{title}</h2>
      {status ? <StatusChip status={status} /> : null}
      <p className="pw-state-summary">
        {capability}
      </p>
      <p className="pw-state-detail">
        {knob}
      </p>
      <CompanionSlot size="empty" />
    </section>
  );
}