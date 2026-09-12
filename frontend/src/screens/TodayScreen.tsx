import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { saveApps, saveJournalEntry, ApiError, type JournalEntry, type ServiceApp, type LabEnvelope } from "../lib/api";
import { useDaily, useApps, useLabState, useJournalPage, useJournalKey, useAgentSyncProjects } from "../lib/hooks";
import { projectCategory, projectSentence, CATEGORY_ORDER, NEEDS_ATTENTION } from "../lib/project-status";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { ErrorState } from "../shell/ErrorState";
import { Button } from "../components/ui/button";
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
 *
 * Composition (T14 warmth, DESIGN-HANDOFF N.7/N.8): no Card chrome —
 * sections are real <h2> headings (A11y §4.1) separated by quiet
 * --pw-color-border-subtle dividers, a time-of-day greeting with the
 * decorative 48px greeting-area companion (COMPANION_INTEGRATION
 * "Inline"), and the healthy/not-yet-connected capability majority
 * collapsed behind one honest count line (Finish Line: "healthy
 * systems stay quiet") — never removed from the DOM.
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

/** Time-of-day greeting (design/screens greeting-block pattern). No
 * name is fabricated: no personal-name field is sent to this screen,
 * so the greeting stays generic and honest. */
function greetingForNow(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 18) return "Good afternoon.";
  return "Good evening.";
}

function localIsoDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The greeting area: warm greeting + decorative 48px companion
 * (COMPANION_INTEGRATION "Inline" — aria-hidden artwork, never a
 * second trigger), the h1, and the host-local date (no hard-coded
 * locale/timezone, same toLocale* pattern as eventTime). */
function TodayHeading() {
  const now = new Date();
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-[var(--pw-spacing-loose)] text-lg text-[var(--pw-color-text-secondary)]">
        <CompanionSlot size="inline" />
        {greetingForNow(now)}
      </p>
      <h1
        id="today-health-heading"
        className="text-3xl font-bold"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        Today
      </h1>
      <p className="text-sm text-[var(--pw-color-text-muted)]">
        <time dateTime={localIsoDate(now)}>
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </time>
      </p>
    </div>
  );
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
        <ProjectsTodaySection />
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
      <section aria-labelledby="today-health-heading" className="space-y-3">
        <TodayHeading />
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
      <section aria-labelledby="today-health-heading" className="space-y-3">
        <TodayHeading />
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
  } else if (vacant === caps.length) {
    // A fresh install where nothing is connected is a valid, non-error
    // state (NATIVE-BASELINE-AND-ENRICHMENT) — it is "ready", not "0
    // are healthy".
    sentence =
      "Your world is ready. Nothing is connected yet — capabilities will show up here as you add them.";
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
    <section aria-labelledby="today-health-heading" className="space-y-3">
      <TodayHeading />
      <p className="text-lg text-[var(--pw-color-text-primary)]">{sentence}</p>
    </section>
  );
}

// ── Attention (/api/daily attention) ──

function AttentionSection({ daily }: { daily: DailyState }) {
  if (daily.isLoading || daily.isError || !daily.data?.ok) return null;
  const items = daily.data.data?.attention ?? [];
  return (
    <section
      aria-labelledby="today-attention-heading"
      className="space-y-3 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
    >
      <h2
        id="today-attention-heading"
        className="flex items-center gap-2 text-lg font-semibold"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        <AlertCircle size={18} aria-hidden={true} />
        Attention
      </h2>
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
    </section>
  );
}

/** The daily loop's "available: X (Y) — not enabled for writes"
 * strings are capability-speak; this is the one shape both Attention
 * and What changed humanize (mirroring legacy api.py
 * humanizeAttention) so the same data reads the same way everywhere. */
const AVAILABLE_NOT_ENABLED_FOR_WRITES =
  /^available: .+ \(([^)]+)\) — not enabled for writes$/;

/** Attention strings run through the humanizing voice: "available:"
 * actions read as opportunities, not faults. */
function humanizeAttention(value: string): string {
  const text = String(value || "");
  const available = text.match(AVAILABLE_NOT_ENABLED_FOR_WRITES);
  const human = available
    ? `${available[1].replaceAll("_", " ")} is ready for looking, not changing things.`
    : text.replaceAll("_", " ");
  return human.charAt(0).toUpperCase() + human.slice(1);
}

/** What changed renders the "available:" shape through the same voice
 * as Attention; every other recorded line keeps its exact content. */
function humanizeWhatChanged(value: string): string {
  const text = String(value || "");
  return AVAILABLE_NOT_ENABLED_FOR_WRITES.test(text) ? humanizeAttention(text) : text;
}

// ── Projects (agent-sync estate; only meaningful state) ──

/** Today tells Rylee what matters, not every repository: attention
 *  projects get a sentence; local work gets one calm mention; a
 *  settled estate gets one settled line; an unavailable sensor is
 *  one quiet sentence (Today must not become a status board). */
function ProjectsTodaySection() {
  const query = useAgentSyncProjects();
  if (query.isLoading && !query.data) return null; // no flash of empty state
  if (query.isError || query.data?.ok !== true || !query.data.data) {
    return null; // Today stays calm; Projects owns the detail + degradation copy
  }
  const data = query.data.data;
  const projects = data.projects ?? [];
  if (projects.length === 0) return null;

  const attention = projects
    .filter((p) => NEEDS_ATTENTION.includes(projectCategory(p)))
    .sort((a, b) =>
      CATEGORY_ORDER[projectCategory(a)] - CATEGORY_ORDER[projectCategory(b)]);
  const localWork = projects.filter((p) => projectCategory(p) === "local_work");
  const unknown = projects.filter((p) => projectCategory(p) === "unknown");

  if (attention.length === 0 && localWork.length === 0 && unknown.length === 0) {
    return (
      <section aria-labelledby="today-projects-heading" className="space-y-1 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]">
        <h2 id="today-projects-heading" className="text-lg font-semibold" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
          Projects
        </h2>
        <p className="text-[var(--pw-color-text-secondary)]">
          Projects are quiet.
        </p>
      </section>
    );
  }

  const bits: string[] = [];
  if (attention.length > 0) {
    bits.push(
      attention.length === 1
        ? "1 needs attention"
        : `${attention.length} need attention`
    );
  }
  if (localWork.length > 0) {
    bits.push(
      localWork.length === 1
        ? "1 has local work"
        : `${localWork.length} have local work`
    );
  }
  if (unknown.length > 0) {
    bits.push(
      unknown.length === 1
        ? "1 could not reach its remote"
        : `${unknown.length} could not reach their remotes`
    );
  }

  return (
    <section aria-labelledby="today-projects-heading" className="space-y-1 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]">
      <h2 id="today-projects-heading" className="text-lg font-semibold" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
        Projects
      </h2>
      <p className="text-[var(--pw-color-text-primary)]">{bits.join(" · ")}</p>
      {attention.length > 0 ? (
        <ul className="space-y-1 text-sm" role="list" data-pw-today-projects="attention">
          {attention.slice(0, 3).map((p) => (
            <li key={p.project}>
              {projectSentence(p)}{" "}
              <Link to="/projects" className="underline decoration-[var(--pw-color-border-subtle)] underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2 rounded-sm">
                See Projects
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {attention.length > 3 ? (
        <p className="text-sm text-[var(--pw-color-text-secondary)]">
          and {attention.length - 3} more in Projects.
        </p>
      ) : null}
    </section>
  );
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
    <section
      aria-labelledby="today-changes-heading"
      className="space-y-3 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
    >
      <div className="space-y-1">
        <h2
          id="today-changes-heading"
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          What changed
        </h2>
        <p className="text-sm text-[var(--pw-color-text-muted)]">Recorded by your world today</p>
      </div>
      <ul className="space-y-2" role="list">
        {changed.slice(0, 5).map((item, i) => (
          <li key={`${i}-${item}`} className="text-[var(--pw-color-text-primary)]">
            {humanizeWhatChanged(item)}
          </li>
        ))}
      </ul>
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
    <section
      aria-labelledby="today-journal-heading"
      className="space-y-3 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
    >
      <div className="space-y-1">
        <h2
          id="today-journal-heading"
          className="flex items-center gap-2 text-lg font-semibold"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          <BookOpen size={18} aria-hidden={true} />
          Your journal
        </h2>
        <p className="text-sm text-[var(--pw-color-text-muted)]">Leave yourself a note about today.</p>
      </div>
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

      <h2
        className="text-base font-semibold"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        Recent entries
      </h2>
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
    <section
      aria-labelledby="today-more-heading"
      className="space-y-4 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
    >
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

/** Statuses that never deserve an individual row at Level 1: the
 * healthy majority and the not-yet-connected (Finish Line: "healthy
 * systems stay quiet"). Everything else — warning,
 * needs_attention, unavailable, stale, unknown, disabled — surfaces
 * as its own row so problems stay visible. */
const QUIET_CAPABILITY_STATUSES = new Set(["healthy", "not_configured"]);

function CapabilitiesPanel({
  caps,
  digestOk,
}: {
  caps: Array<[string, { ok: boolean; status: string; warnings: string[]; last_observed: string }]>;
  digestOk: boolean;
}) {
  const surfaced = caps.filter(([, cap]) => !QUIET_CAPABILITY_STATUSES.has(cap.status));
  const quiet = caps.filter(([, cap]) => QUIET_CAPABILITY_STATUSES.has(cap.status));
  const quietLine =
    `${quiet.length} ${surfaced.length > 0 ? "other " : ""}` +
    `${quiet.length === 1 ? "capability is" : "capabilities are"} healthy or not yet connected.`;
  const quietSummary =
    quiet.length === 1 ? "Show the other one" : `Show the other ${quiet.length}`;
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
        <div className="space-y-2">
          {surfaced.length > 0 ? (
            <ul className="space-y-2" role="list">
              {surfaced.map(([name, cap]) => (
                <CapabilityRow key={name} name={name} cap={cap} />
              ))}
            </ul>
          ) : null}
          {quiet.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[var(--pw-color-text-secondary)]">{quietLine}</p>
              <Disclosure summary={quietSummary} level={3}>
                <ul className="space-y-2" role="list">
                  {quiet.map(([name, cap]) => (
                    <CapabilityRow key={name} name={name} cap={cap} />
                  ))}
                </ul>
              </Disclosure>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CapabilityRow({
  name,
  cap,
}: {
  name: string;
  cap: { ok: boolean; status: string; warnings: string[]; last_observed: string };
}) {
  const status = asCanonicalStatus(cap.status);
  return (
    <li>
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
