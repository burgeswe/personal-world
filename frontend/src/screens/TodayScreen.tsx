import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { saveApps, saveJournalEntry, ApiError, type JournalEntry, type ServiceApp, type LabEnvelope } from "../lib/api";
import { useDaily, useApps, useLabState, useJournalPage, useJournalKey } from "../lib/hooks";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { ErrorState } from "../shell/ErrorState";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Loader2, AlertCircle, BookOpen, Plus } from "../lib/icons";

/**
 * TodayScreen (P1 T10, parity rows 1–3, FOUNDATION-SPEC §7):
 *
 * Everything renders from real data via the typed client:
 * - health sentence from /api/status (capability counts, canonical words);
 * - attention list from /api/daily (daily.data.attention) — a quiet day
 *   renders the honest "Nothing needs your attention", never a green list;
 * - "what changed" from /api/daily actions — ABSENT entirely on a quiet
 *   day (no fabricated "Recent Changes", row 15);
 * - journal composer + recent entries from /api/journal?n=;
 * - "More from your world": Services launcher (GET/PUT /api/apps with
 *   step-up via useStepUp), Subscription usage (lab packet rows),
 *   Capabilities table with per-row StatusChip + Disclosure provenance.
 *
 * The shell owns <main#main-content> — this screen renders bare inside
 * it. Dates render from the host (toLocaleDateString); no hard-coded
 * version/timezone/host strings anywhere (row 15).
 */

/** "chat exchange with …" is humanized like the legacy journal (api.py
 * eventSummary) — the technical opening is never the person's words. */
function eventSummary(entry: JournalEntry): string {
  const summary = String(entry.summary || "Journal entry");
  if (summary.toLowerCase().startsWith("chat exchange with ")) {
    return "A conversation with Personal World";
  }
  return summary;
}

function eventTime(ts: string): string {
  const date = new Date(ts);
  if (!ts || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A raw status from the server is only a chip if it is canonical
 * (status.py vocabulary); unknown words render no chip, not a lie. */
const CANONICAL_STATUS_LIST = [
  "healthy",
  "warning",
  "unknown",
  "needs_attention",
  "unavailable",
  "stale",
  "disabled",
  "not_configured",
] as const;

function asCanonicalStatus(status: string): CanonicalStatus | null {
  return (CANONICAL_STATUS_LIST as readonly string[]).includes(status)
    ? (status as CanonicalStatus)
    : null;
}

function TodayScreen() {
  const daily = useDaily();
  const journal = useJournalPage(20);
  const apps = useApps();
  const lab = useLabState();
  const bumpJournal = useJournalKey();
  const { announce } = useAnnounce();
  const stepUp = useStepUp();

  return (
    <>
      {stepUp.prompt}
      {/* The shell owns the content measure (index.css .pw-main); this
          screen renders bare inside it — one width system per route
          (T14 human gate 2). */}
      <div className="space-y-6">
        <HealthSection daily={daily} />
        <AttentionSection daily={daily} />
        <WhatChangedSection daily={daily} />
        <JournalSection journal={journal} onSaved={() => { bumpJournal(); announce("Note saved to your journal.", { kind: "action_completed", key: "today-journal-note" }); }} />
        <MoreFromWorld daily={daily} apps={apps} lab={lab} stepUp={stepUp} announce={announce} />
      </div>
    </>
  );
}

type DailyState = ReturnType<typeof useDaily>;

// ── Health sentence (/api/status via the daily digest) ──

function HealthSection({ daily }: { daily: DailyState }) {
  if (daily.isLoading) {
    return (
      <section aria-labelledby="today-health-heading" className="space-y-2">
        <h1 id="today-health-heading" className="text-3xl font-bold" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
          Today
        </h1>
        <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]">
          <Loader2 size={16} aria-hidden={true} className="loader-static" />
          Checking your world…
        </p>
      </section>
    );
  }
  if (daily.isError) {
    return (
      <ErrorState
        title="Today"
        failed="could not load your daily digest"
        detail={detailOf(daily.error)}
        onRetry={() => void daily.refetch()}
      />
    );
  }
  const result = daily.data;
  if (!result) return null;
  if (!result.ok) {
    return (
      <section aria-labelledby="today-health-heading" className="space-y-2">
        <h1 id="today-health-heading" className="text-3xl font-bold" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
          Today
        </h1>
        <p className="text-[var(--pw-color-text-primary)]">
          Some current details are unavailable. Your journal and saved world are still here.
        </p>
      </section>
    );
  }

  const caps = Object.entries(result.data?.capabilities ?? {});
  const healthy = caps.filter(([, c]) => c.status === "healthy").length;
  const actionable = caps.filter(([, c]) =>
    ["warning", "needs_attention", "unavailable", "stale"].includes(c.status)
  ).length;
  const uncertain = caps.filter(([, c]) => c.status === "unknown").length;
  const vacant = caps.filter(([, c]) => c.status === "not_configured").length;

  let sentence: string;
  if (caps.length === 0) {
    sentence = "Your world is ready. Nothing is connected yet.";
  } else if (actionable > 0) {
    sentence =
      `${actionable} ${actionable === 1 ? "thing needs" : "things need"} a look. ` +
      `${healthy} ${healthy === 1 ? "capability is" : "capabilities are"} healthy.`;
  } else if (uncertain > 0) {
    sentence =
      `Nothing urgent, but ${uncertain} ` +
      `${uncertain === 1 ? "capability has" : "capabilities have"} not been checked yet. ` +
      `${healthy} ${healthy === 1 ? "is" : "are"} healthy.`;
  } else {
    sentence =
      `Nothing urgent. ${healthy} ${healthy === 1 ? "capability is" : "capabilities are"} healthy` +
      (vacant > 0 ? `, and ${vacant} are waiting until you need them.` : ".");
  }

  return (
    <section aria-labelledby="today-health-heading" className="space-y-2">
      <h1
        id="today-health-heading"
        className="text-3xl font-bold"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        Today
      </h1>
      <p className="text-lg text-[var(--pw-color-text-primary)]">{sentence}</p>
    </section>
  );
}

// ── Attention (/api/daily attention) ──

function AttentionSection({ daily }: { daily: DailyState }) {
  if (daily.isLoading || daily.isError || !daily.data?.ok) return null;
  const items = daily.data.data?.attention ?? [];
  return (
    <section aria-labelledby="today-attention-heading">
      <Card>
        <CardHeader>
          <CardTitle id="today-attention-heading" className="flex items-center gap-2">
            <AlertCircle size={18} aria-hidden={true} />
            Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-[var(--pw-color-text-secondary)]">
              Nothing needs your attention.
            </p>
          ) : (
            <ul className="space-y-2" role="list">
              {items.slice(0, 5).map((item, i) => (
                <li key={`${i}-${item}`} className="text-[var(--pw-color-text-primary)]">
                  {humanizeAttention(item)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/** The daily loop's attention strings are capability-speak; mirror the
 * legacy humanizing (api.py humanizeAttention) so "available:" actions
 * read as opportunities, not faults. */
function humanizeAttention(value: string): string {
  const text = String(value || "");
  const available = text.match(/^available: .+ \(([^)]+)\) — not enabled for writes$/);
  const human = available
    ? `${available[1].replaceAll("_", " ")} is ready for looking, not changing things.`
    : text.replaceAll("_", " ");
  return human.charAt(0).toUpperCase() + human.slice(1);
}

// ── What changed (/api/daily actions; ABSENT on a quiet day) ──

function WhatChangedSection({ daily }: { daily: DailyState }) {
  const changed = daily.data?.actions ?? [];
  const digestOk = daily.data?.ok === true;
  if (!digestOk || changed.length === 0) {
    // A quiet day shows NO "what changed" list — parity row 1: no
    // fabricated content, the section simply does not exist.
    return null;
  }
  return (
    <section aria-labelledby="today-changes-heading">
      <Card>
        <CardHeader>
          <CardTitle id="today-changes-heading">What changed</CardTitle>
          <CardDescription>Recorded by your world today</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" role="list">
            {changed.slice(0, 5).map((item, i) => (
              <li key={`${i}-${item}`} className="text-[var(--pw-color-text-primary)]">
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

// ── Journal composer + recent entries (/api/journal) ──

function JournalSection({
  journal,
  onSaved,
}: {
  journal: ReturnType<typeof useJournalPage>;
  onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveJournalEntry(text);
      setNote("");
      onSaved();
    } catch (e) {
      setError(
        e instanceof ApiError && e.detail
          ? e.detail
          : "That note did not save. It is still in the box so you can try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const recent = useMemo(() => {
    const events = journal.data ?? [];
    // Mirror legacy: capability self-observations are loop noise, not
    // the person's day (api.py renderToday filters "capability …").
    const source = events.filter(
      (event) => !String(event.summary || "").toLowerCase().startsWith("capability ")
    );
    const seen = new Set<string>();
    const picked: JournalEntry[] = [];
    for (const event of [...source].reverse()) {
      const summary = eventSummary(event);
      if (seen.has(summary)) continue;
      seen.add(summary);
      picked.push(event);
      if (picked.length === 5) break;
    }
    return picked;
  }, [journal.data]);

  return (
    <section aria-labelledby="today-journal-heading" className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle id="today-journal-heading" className="flex items-center gap-2">
            <BookOpen size={18} aria-hidden={true} />
            Your journal
          </CardTitle>
          <CardDescription>Leave yourself a note about today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label htmlFor="today-journal-note" className="sr-only">
            Journal note
          </label>
          <textarea
            id="today-journal-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened? What did you notice?"
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <div className="flex items-center justify-between gap-3">
            <Button type="button" onClick={() => void save()} disabled={!note.trim() || saving}>
              Save entry
            </Button>
            <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
              {error ?? (saving ? "Saving…" : "")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {journal.isLoading ? (
            <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]">
              <Loader2 size={16} aria-hidden={true} className="loader-static" />
              Opening your journal…
            </p>
          ) : journal.isError ? (
            <p className="text-[var(--pw-color-text-primary)]">
              Your journal could not be opened just now. Your note box is unaffected.
            </p>
          ) : recent.length === 0 ? (
            <p className="text-[var(--pw-color-text-secondary)]">
              No journal entries yet. This is a gentle place to begin.
            </p>
          ) : (
            <ul className="space-y-2" role="list" aria-label="Recent entries">
              {recent.map((entry, i) => (
                <li key={`${entry.ts}-${i}`} className="flex items-baseline gap-2">
                  <time dateTime={entry.ts} className="shrink-0 text-sm text-[var(--pw-color-text-muted)]">
                    {eventTime(entry.ts)}
                  </time>
                  <span className="text-[var(--pw-color-text-primary)]">{eventSummary(entry)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3">
            <Link to="/journal" className="pw-nav-link inline-flex">
              View all in Journal
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

// ── More from your world: Services, Subscription usage, Capabilities ──

type LabRow = {
  row: string;
  count: number;
  stale?: boolean;
  observations: Array<{ detail: string; action?: string | null; state?: string; observed_at?: string }>;
};

/** useLabState unwraps the Result envelope: lab.data IS the packet
 * ({rows, schema, generated_at}); a failed packet yields
 * {rows: [], reason} (api.py lab_state). */
type LabPacket = { rows?: LabRow[]; reason?: string; schema?: string; generated_at?: string };

function MoreFromWorld({
  daily,
  apps,
  lab,
  stepUp,
  announce,
}: {
  daily: DailyState;
  apps: ReturnType<typeof useApps>;
  lab: ReturnType<typeof useLabState>;
  stepUp: ReturnType<typeof useStepUp>;
  announce: ReturnType<typeof useAnnounce>["announce"];
}) {
  const caps = Object.entries(daily.data?.data?.capabilities ?? {});

  return (
    <section aria-labelledby="today-more-heading" className="space-y-4">
      <h2 id="today-more-heading" className="sr-only">
        More from your world
      </h2>
      <Disclosure summary="More from your world" level={2}>
        <div className="space-y-4 pt-2">
          <ServicesPanel apps={apps} stepUp={stepUp} announce={announce} />
          <SubscriptionPanel lab={lab} />
          <CapabilitiesPanel caps={caps} digestOk={daily.data?.ok === true} />
        </div>
      </Disclosure>
    </section>
  );
}

function ServicesPanel({
  apps,
  stepUp,
  announce,
}: {
  apps: ReturnType<typeof useApps>;
  stepUp: ReturnType<typeof useStepUp>;
  announce: ReturnType<typeof useAnnounce>["announce"];
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  const add = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) {
      setStatus("Add both a name and an address.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported");
    } catch {
      setStatus("Use a complete http or https address.");
      return;
    }
    const current = Array.isArray(apps.data) ? apps.data : [];
    const next: ServiceApp[] = [
      ...current,
      {
        id: trimmedName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        name: trimmedName,
        url: parsed.toString(),
      },
    ];
    setAdding(true);
    setStatus("Adding…");
    try {
      await stepUp.withStepUp(() => saveApps(next));
      setName("");
      setUrl("");
      setStatus("Service added.");
      announce("Service added to your launcher.", { kind: "action_completed", key: "today-service-added" });
      await apps.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setStatus("Add cancelled — the service was not added.");
      } else {
        setStatus("That service was not added. Check the address and try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const services = Array.isArray(apps.data) ? apps.data : [];

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Services</h3>
      {apps.isLoading ? (
        <p className="text-[var(--pw-color-text-muted)]">Opening your services…</p>
      ) : apps.isError ? (
        <p className="text-[var(--pw-color-text-primary)]">
          Saved services could not be opened. You can try again later.
        </p>
      ) : services.length === 0 ? (
        <p className="text-[var(--pw-color-text-secondary)]">
          No services saved here yet. Add one when it would be useful.
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {services.map((app, i) => (
            <li key={`${app.id}-${i}`}>
              <a href={app.url} rel="noopener noreferrer" className="pw-nav-link inline-flex">
                {app.name || app.id}
                {app.category ? <span className="text-[var(--pw-color-text-muted)]"> — {app.category}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-xl border border-[var(--pw-color-border-subtle)] p-3">
        <label htmlFor="svc-name" className="sr-only">
          Service name
        </label>
        <input
          id="svc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service name"
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <label htmlFor="svc-url" className="sr-only">
          Service address
        </label>
        <input
          id="svc-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <div className="flex items-center justify-between gap-3">
          <Button type="button" onClick={() => void add()} disabled={adding}>
            <Plus size={16} aria-hidden={true} />
            Add service
          </Button>
          <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}

function SubscriptionPanel({ lab }: { lab: ReturnType<typeof useLabState> }) {
  const envelope = lab.data as LabEnvelope | undefined;
  const packet = (envelope?.data ?? undefined) as LabPacket | undefined;
  const rows = packet?.rows ?? [];
  const observations = rows.flatMap((row) => row.observations ?? []);
  const quota = observations.filter((o) => {
    const detail = String(o.detail || "");
    return (
      detail.includes("credit balance") ||
      detail.includes("/used ") ||
      (detail.includes("window") && detail.includes("%") && detail.includes("resets"))
    );
  });
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Subscription usage</h3>
      {lab.isLoading ? (
        <p className="text-[var(--pw-color-text-muted)]">Checking usage…</p>
      ) : lab.isError ? (
        <p className="text-[var(--pw-color-text-primary)]">
          Usage details are unavailable right now. Everything else still works.
        </p>
      ) : quota.length === 0 ? (
        <p className="text-[var(--pw-color-text-secondary)]">
          No current subscription limits need your attention.
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {quota.slice(0, 5).map((o, i) => (
            <li key={i} className="text-[var(--pw-color-text-primary)]">
              {o.detail || "Usage observation"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CapabilitiesPanel({
  caps,
  digestOk,
}: {
  caps: Array<[string, { ok: boolean; status: string; warnings: string[]; last_observed: string }]>;
  digestOk: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Capabilities</h3>
      {!digestOk ? (
        <p className="text-[var(--pw-color-text-secondary)]">
          Capabilities could not be checked just now. Your journal and saved world are still available.
        </p>
      ) : caps.length === 0 ? (
        <p className="text-[var(--pw-color-text-secondary)]">No capabilities defined.</p>
      ) : (
        <ul className="space-y-2" role="list">
          {caps.map(([name, cap]) => {
            const status = asCanonicalStatus(cap.status);
            return (
              <li key={name}>
                <Disclosure summary={name.replaceAll("_", " ")} level={3}>
                  <div className="space-y-2 pt-1">
                    <StatusChip status={status} />
                    {cap.warnings?.length ? (
                      <p>{cap.warnings[0]}</p>
                    ) : (
                      <p>Observed {ageText(cap.last_observed)} ago.</p>
                    )}
                    <TechnicalDetails
                      provider={`capability: ${name}`}
                      raw={JSON.stringify({ status: cap.status, ok: cap.ok })}
                    />
                  </div>
                </Disclosure>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ageText(value: string): string {
  const dt = new Date(value);
  if (!value || Number.isNaN(dt.getTime())) return "unknown";
  const mins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h`;
  return `${Math.floor(mins / 1440)} d`;
}

function detailOf(error: Error | null): string | null {
  return error instanceof ApiError ? error.detail : null;
}

export default TodayScreen;