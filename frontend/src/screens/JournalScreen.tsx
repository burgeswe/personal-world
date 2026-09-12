import { useMemo, useState } from "react";
import { saveJournalEntry, ApiError, type JournalEntry } from "../lib/api";
import { useJournalPage, useJournalKey } from "../lib/hooks";
import { useAnnounce } from "../primitives/LiveRegion";
import { Disclosure } from "../primitives/Disclosure";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Loader2, BookOpen } from "../lib/icons";

/**
 * JournalScreen (P1 T10, parity row 4, FOUNDATION-SPEC §7):
 *
 * Real /api/journal data only. Kind filters are aria-pressed toggles
 * (client-side on the loaded page, exactly like the legacy `.jfilter`
 * behavior); "Load more" re-fetches with a larger `n=` query param.
 * Provenance renders through Disclosure (Level 3, "Source") and
 * TechnicalDetails (Level 4) — provider/observed_at/authority, never
 * fabricated. The shell owns <main#main-content>.
 */

const KIND_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "observation", label: "Observations" },
  { value: "drift", label: "Drift" },
  { value: "failure", label: "Failures" },
  { value: "settings_change", label: "Settings" },
];

const PAGE_STEPS = [20, 100, 500];

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

function fullTime(ts: string): string {
  const date = new Date(ts);
  if (!ts || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function JournalScreen() {
  const [pageSize, setPageSize] = useState(0); // index into PAGE_STEPS
  const journal = useJournalPage(PAGE_STEPS[pageSize]);
  const bumpJournal = useJournalKey();
  const { announce } = useAnnounce();
  const [kind, setKind] = useState("all");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteStatus, setNoteStatus] = useState("");

  const entries = journal.data ?? [];
  const filtered = useMemo(
    () => (kind === "all" ? entries : entries.filter((e) => e.kind === kind)),
    [entries, kind]
  );

  const canLoadMore = pageSize < PAGE_STEPS.length - 1;

  const loadMore = () => {
    const next = Math.min(pageSize + 1, PAGE_STEPS.length - 1);
    setPageSize(next);
  };

  const saveNote = async () => {
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    setNoteStatus("");
    try {
      await saveJournalEntry(text);
      setNote("");
      bumpJournal();
      setNoteStatus("Saved to your journal.");
      announce("Note saved to your journal.", {
        kind: "action_completed",
        key: "journal-note-saved",
      });
    } catch (e) {
      setNoteStatus(
        e instanceof ApiError && e.detail
          ? e.detail
          : "That note did not save. It is still in the box so you can try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="journal-page-heading" className="space-y-2">
        <h1
          id="journal-page-heading"
          className="text-3xl font-bold"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          Journal
        </h1>
        <p className="text-[var(--pw-color-text-muted)]">
          What has happened in your world, as it was recorded.
        </p>
      </section>

      {/* Composer */}
      <section aria-labelledby="journal-composer-heading">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 id="journal-composer-heading" className="text-lg font-semibold">
              Leave a note
            </h2>
            <label htmlFor="journal-note" className="sr-only">
              Journal note
            </label>
            <textarea
              id="journal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened? What did you notice?"
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <div className="flex items-center justify-between gap-3">
              <Button type="button" onClick={() => void saveNote()} disabled={!note.trim() || saving}>
                Save entry
              </Button>
              <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
                {saving ? "Saving…" : noteStatus}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Kind filters: aria-pressed toggles (parity row 4) */}
      <section aria-labelledby="journal-filters-heading">
        <h2 id="journal-filters-heading" className="sr-only">
          Filter journal entries by kind
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Journal kind filters">
          {KIND_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={kind === filter.value}
              onClick={() => setKind(filter.value)}
              className="rounded-full border border-[var(--pw-color-border-subtle)] px-4 text-sm font-medium text-[var(--pw-color-text-secondary)] hover:text-[var(--pw-color-text-primary)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2 data-[pressed=true]:border-[var(--pw-color-accent-primary)] data-[pressed=true]:text-[var(--pw-color-text-primary)]"
              data-pressed={kind === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* Entries */}
      {journal.isLoading ? (
        <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]" role="status">
          <Loader2 size={16} aria-hidden={true} className="loader-static" />
          Opening your journal…
        </p>
      ) : journal.isError ? (
        <section aria-labelledby="journal-error-heading" data-pw-state="error" className="pw-state">
          <h2 id="journal-error-heading">Journal</h2>
          <p className="pw-state-summary">
            Could not load journal entries —
            {" "}
            <span className="pw-state-detail-inline">
              {journal.error instanceof ApiError && journal.error.detail
                ? journal.error.detail
                : "the request did not complete"}
            </span>
            .
          </p>
          <button type="button" className="pw-state-retry" onClick={() => void journal.refetch()}>
            Try again
          </button>
          <p className="pw-state-detail">
            The rest of your world still works: every section in Main stays available while this one is failing.
          </p>
        </section>
      ) : filtered.length === 0 ? (
        <section aria-labelledby="journal-empty-heading">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <BookOpen size={36} aria-hidden={true} />
              <h2
                id="journal-empty-heading"
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
              >
                {entries.length === 0 ? "No journal entries yet" : "No entries of this kind yet"}
              </h2>
              <p className="text-center text-[var(--pw-color-text-muted)]">
                {entries.length === 0
                  ? "Entries appear as your world observes things — and whenever you leave a note."
                  : "Try another filter to see what else has been recorded."}
              </p>
            </CardContent>
          </Card>
        </section>
      ) : (
        <ul className="space-y-3" role="list" aria-label="Journal entries">
          {[...filtered].reverse().map((entry, i) => (
            <li key={`${entry.ts}-${i}`}>
              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[var(--pw-color-text-primary)]">{eventSummary(entry)}</p>
                    <time dateTime={entry.ts} className="shrink-0 text-sm text-[var(--pw-color-text-muted)]">
                      {eventTime(entry.ts)}
                    </time>
                  </div>
                  <p className="text-sm text-[var(--pw-color-text-muted)]">
                    Kind: {entry.kind}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Disclosure summary="Source" level={3}>
                      <div className="space-y-1 pt-1 text-sm">
                        <p>
                          Recorded by {entry.provenance?.source ?? "an unknown source"}.
                        </p>
                        <p>Recorded at {fullTime(entry.provenance?.observed_at ?? entry.ts)}.</p>
                      </div>
                    </Disclosure>
                    <TechnicalProvenance entry={entry} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Load more: re-queries /api/journal?n= with a larger n (row 4) */}
      {canLoadMore && entries.length > 0 ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore}>
            Load more entries
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TechnicalProvenance({ entry }: { entry: JournalEntry }) {
  if (!entry.provenance) return null;
  return (
    <Disclosure summary="Technical details" level={4}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-[var(--pw-color-text-muted)]">Source</dt>
        <dd>{entry.provenance.source}</dd>
        <dt className="text-[var(--pw-color-text-muted)]">Provider</dt>
        <dd>{entry.provenance.provider ?? "none"}</dd>
        <dt className="text-[var(--pw-color-text-muted)]">Authority</dt>
        <dd>{entry.provenance.authority}</dd>
        <dt className="text-[var(--pw-color-text-muted)]">Observed</dt>
        <dd>{entry.provenance.observed_at}</dd>
      </dl>
    </Disclosure>
  );
}

export default JournalScreen;