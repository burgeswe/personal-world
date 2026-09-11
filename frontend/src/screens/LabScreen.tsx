import { EmptyState } from "../shell/EmptyState";
import { ErrorState } from "../shell/ErrorState";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { TechnicalDetails } from "../primitives/Disclosure";
import { useLabState, useLabHealth } from "../lib/hooks";
import type { LabEnvelope } from "../lib/api";
import { Loader2 } from "../lib/icons";

/**
 * LabScreen (P1 T13, FOUNDATION-SPEC §7 parity row 3): the REAL operator
 * table from `GET /api/lab/state` (the lab-lowbw/1 packet via the homelab
 * Lab CLI). Presentation-only truth, exactly as the backend reports it:
 *
 * - one row per operator row (urgent / review / safe / unknown /
 *   last_known_good / next — plus any unrecognized rows the schema grew,
 *   shown honestly, never dropped);
 * - StatusChip per row, canonical statuses only (stale/healthy on
 *   evidence rows; unknown where the packet gives no claim);
 * - per-row provenance behind a Level-4 Disclosure (TechnicalDetails:
 *   provider, latency as observed-at, raw observation JSON) — A11y §4.6;
 * - when the lab capability is absent the screen degrades to the shell
 *   EmptyState naming the capability and the `PW_LAB_CLI` knob, with the
 *   same language the backend uses ("Lab provider not configured — set
 *   `PW_LAB_CLI`"); a present-but-failing CLI renders `unavailable`
 *   with the server's warning as detail, never a guessed row.
 *
 * Honesty boundaries (HRC explicit state; plan C-2): no invented hosts,
 * services, or statuses; no mount path ever leaks into copy — the only
 * implementation name is the documented server-side knob.
 */

interface LabObservation {
  detail: string;
  action?: string | null;
  state?: string;
  observed_at?: string;
}

interface LabRow {
  row: string;
  count: number;
  stale?: boolean;
  unrecognized?: boolean;
  observations?: LabObservation[];
}

interface LabStateData {
  rows?: LabRow[];
  schema?: string;
  generated_at?: string;
  reason?: string;
}

interface LabHealthData {
  total?: number;
  healthy?: number;
  unhealthy?: number;
  restarting?: number;
  stopped?: number;
}

/** Canonical-status guard: statuses outside status.py render as unknown. */
function asCanonicalStatus(raw: string | undefined | null): CanonicalStatus {
  const known: readonly string[] = [
    "healthy", "warning", "unknown", "needs_attention",
    "unavailable", "stale", "disabled", "not_configured",
  ];
  return raw && known.includes(raw) ? (raw as CanonicalStatus) : "unknown";
}

/** Humanized operator-row name ("last_known_good" → "last known good"). */
function rowLabel(row: string): string {
  return row.replace(/_/g, " ");
}

function observedAtLabel(observed_at: string | undefined): string | undefined {
  if (!observed_at) return undefined;
  const ts = new Date(observed_at);
  if (Number.isNaN(ts.getTime())) return undefined;
  return `observed ${ts.toLocaleString()}`;
}

export default function LabScreen() {
  const lab = useLabState();
  const health = useLabHealth();

  if (lab.isLoading || health.isLoading) {
    return (
      <div data-pw-lab="loading">
        <h1 id="lab-heading">Lab</h1>
        <p>
          <Loader2 className="loader-static" aria-hidden={true} /> Checking your
          lab…
        </p>
      </div>
    );
  }

  if (lab.isError || health.isError) {
    const error = (lab.error ?? health.error) as Error | null;
    return (
      <div data-pw-lab="error">
        <ErrorState
          title="Lab"
          headingLevel={1}
          failed="could not load the lab operator table"
          detail={error instanceof Error ? error.message : null}
          onRetry={() => {
            void lab.refetch();
            void health.refetch();
          }}
        />
      </div>
    );
  }

  const state: LabEnvelope | null = lab.data ?? null;
  const healthEnvelope: LabEnvelope | null = health.data ?? null;
  const stateData = (state?.data ?? null) as LabStateData | null;
  const healthCounts = (healthEnvelope?.data ?? null) as LabHealthData | null;

  // Absent capability: the backend answers ok:false with status
  // not_configured when no provider serves the homelab_health
  // capability (registry.observe: "no provider for capability").
  // Mirror its language and name the PW_LAB_CLI knob. A present-but-
  // failing CLI is `unavailable` — the server's warning is the detail.
  // The wrapper is a div: EmptyState/ErrorState carry the region and
  // (headingLevel 1) the page's single h1 — never a stacked duplicate.
  if (!state || state.ok === false) {
    const status = asCanonicalStatus(state?.status ?? "not_configured");
    const absent =
      status === "not_configured" || status === "disabled" || !state;
    return (
      <div data-pw-lab="absent">
        {absent ? (
          <EmptyState
            title="Lab"
            headingLevel={1}
            capability="Lab watches the health of your homelab services."
            knob="Lab provider not configured — set the lab command-line path (PW_LAB_CLI) in your server settings to enable this section."
            status={status}
          />
        ) : (
          <ErrorState
            title="Lab"
            headingLevel={1}
            failed="the lab command-line could not be reached"
            detail={state?.warnings?.[0] ?? null}
            onRetry={() => {
              void lab.refetch();
              void health.refetch();
            }}
          />
        )}
      </div>
    );
  }

  const rows = stateData?.rows ?? [];

  // An envelope that never carried rows (null data) is honest unknown,
  // not a fabricated empty table: degrade to the EmptyState with the
  // canonical unknown chip.
  if (!stateData || !Array.isArray(stateData.rows)) {
    return (
      <div data-pw-lab="unknown">
        <EmptyState
          title="Lab"
          headingLevel={1}
          capability="Lab watches the health of your homelab services."
          knob="Lab provider not configured — set the lab command-line path (PW_LAB_CLI) in your server settings to enable this section."
          status="unknown"
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="lab-heading" data-pw-lab="table">
      <h1 id="lab-heading">Lab</h1>

      {/* Level-1 glance: one quiet line; the counts are the packet's own. */}
      <p>
        {healthCounts && typeof healthCounts.total === "number"
          ? `${healthCounts.total} services checked` +
            (healthCounts.unhealthy || healthCounts.restarting
              ? ` — ${healthCounts.unhealthy} unhealthy, ${healthCounts.restarting} restarting`
              : " — all reported healthy")
          : "Operator rows from your homelab; evidence freshness is enforced upstream."}
      </p>

      {rows.length === 0 ? (
        <p data-pw-lab="empty-packet">The lab packet arrived but reported no operator rows.</p>
      ) : (
        <table data-pw-lab-table="operator-rows">
          <caption className="sr-only">
            Lab operator rows with per-row provenance
          </caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Items</th>
              <th scope="col">State</th>
              <th scope="col">Freshness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const chipStatus: CanonicalStatus = r.unrecognized
                ? "unknown"
                : r.stale
                  ? "stale"
                  : "healthy";
              return (
                <tr key={r.row} data-pw-lab-row={r.row}>
                  <th scope="row">{rowLabel(r.row)}</th>
                  <td>{r.count}</td>
                  <td>
                    {r.unrecognized
                      ? "unrecognized row (schema grew upstream)"
                      : r.observations && r.observations.length > 0
                        ? (r.observations[0].state ?? "unknown").replace(/_/g, " ")
                        : "clear"}
                  </td>
                  <td>
                    <StatusChip status={chipStatus} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Per-row provenance: Level 4 (technical) progressive disclosure.
          Glance truth stays above; the disclosure only adds provenance. */}
      {rows
        .filter((r) => (r.observations?.length ?? 0) > 0)
        .map((r) => (
          <TechnicalDetails
            key={r.row}
            provider="lab state (homelab Lab CLI)"
            latency={observedAtLabel(
              r.observations?.[0]?.observed_at
            )}
            raw={JSON.stringify(r.observations?.[0] ?? {})}
          />
        ))}
    </section>
  );
}