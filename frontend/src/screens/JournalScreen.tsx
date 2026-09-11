import { useState } from "react";
import { saveJournalEntry, ApiError } from "../lib/api";
import { useJournal, useJournalKey } from "../lib/hooks";
import {
  Card,
  CardContent,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Loader2,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Settings,
  GitCommit,
  Heart,
  FileText,
  Plus,
  X,
  Search,
  Filter,
} from "../lib/icons";

type JournalEntry = {
  ts: string;
  kind: string;
  summary: string;
  provenance?: { source: string };
};

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "observation", label: "Observations" },
  { value: "deployment", label: "Deployments" },
  { value: "health", label: "Health" },
  { value: "settings", label: "Settings" },
  { value: "documentation", label: "Docs" },
];

function JournalScreen() {
  const journal = useJournal();
  const bumpJournal = useJournalKey();
  const [showComposer, setShowComposer] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // ── Loading State ──
  if (journal.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Loader2
          className="h-8 w-8 loader-static text-[var(--pw-color-accent-primary)]"
          aria-hidden={true}
        />
        <p className="text-[var(--pw-color-text-muted)]">Loading journal…</p>
      </div>
    );
  }

  // ── Error State ──
  if (journal.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle
          className="h-8 w-8 text-[var(--pw-color-text-primary)]"
          aria-hidden={true}
        />
        <p className="text-[var(--pw-color-text-muted)]">
          Could not load journal entries.
        </p>
      </div>
    );
  }

  const allEntries = journal.data || [];

  // Filter entries
  const filteredEntries = allEntries.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === "all" ||
      entry.kind === typeFilter ||
      getJournalIcon(entry.kind, entry.summary).label === typeFilter;
    return matchesSearch && matchesType;
  });

  const grouped = groupByDate(filteredEntries);

  return (
    <div className="space-y-4 p-4">
      {/* ── Header ── */}
      <section aria-labelledby="journal-heading">
        <div className="flex items-start justify-between">
          <div>
            <h1
              id="journal-heading"
              className="text-3xl font-bold text-[var(--pw-color-text-primary)]"
              style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
            >
              Journal
            </h1>
            <p className="mt-1 text-[var(--pw-color-text-muted)]">
              What has happened in your world
            </p>
          </div>
          <Button onClick={() => setShowComposer(true)}>
            <Plus className="h-4 w-4" aria-hidden={true} />
            Add Entry
          </Button>
        </div>
      </section>

      {/* ── Search + Filters ── */}
      {allEntries.length > 0 && (
        <section aria-labelledby="filter-heading">
          <h2 id="filter-heading" className="sr-only">
            Filter journal entries
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pw-color-text-muted)]"
                aria-hidden={true}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries…"
                className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] py-2 pl-10 pr-4 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]"
                aria-label="Search journal entries"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <Filter
                className="h-4 w-4 text-[var(--pw-color-text-muted)]"
                aria-hidden={true}
              />
              <div className="flex flex-wrap gap-1">
                {TYPE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setTypeFilter(filter.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      typeFilter === filter.value
                        ? "bg-[var(--pw-color-accent-primary)] text-[var(--pw-color-surface-canvas)]"
                        : "bg-[var(--pw-color-surface-elevated)] text-[var(--pw-color-text-secondary)] hover:text-[var(--pw-color-text-primary)]"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Empty State ── */}
      {allEntries.length === 0 && (
        <section aria-labelledby="empty-heading">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen
                className="h-12 w-12 text-[var(--pw-color-text-muted)]"
                aria-hidden={true}
              />
              <h2
                id="empty-heading"
                className="mt-4 text-lg font-semibold text-[var(--pw-color-text-primary)]"
                style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
              >
                No journal entries yet
              </h2>
              <p className="mt-2 text-center text-[var(--pw-color-text-muted)]">
                Your world will record observations, decisions, and changes
                here.
              </p>
              <Button className="mt-4" onClick={() => setShowComposer(true)}>
                <Plus className="h-4 w-4" aria-hidden={true} />
                Add your first entry
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── No results ── */}
      {allEntries.length > 0 && filteredEntries.length === 0 && (
        <section aria-labelledby="no-results-heading">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Search
                className="h-8 w-8 text-[var(--pw-color-text-muted)]"
                aria-hidden={true}
              />
              <p
                id="no-results-heading"
                className="mt-3 text-[var(--pw-color-text-muted)]"
              >
                No entries match your search.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Timeline ── */}
      {grouped.map((group) => (
        <section key={group.label} aria-labelledby={`date-${group.label}`}>
          <h2
            id={`date-${group.label}`}
            className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--pw-color-text-muted)]"
          >
            {group.label}
          </h2>
          <div className="space-y-3">
            {group.entries.map((entry, i) => {
              const icon = getJournalIcon(entry.kind, entry.summary);
              const Icon = icon.icon;
              const time = formatTime(entry.ts);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full text-left"
                >
                  <Card className="transition-colors hover:border-[var(--pw-color-accent-primary)]/50">
                    <CardContent className="flex items-start gap-4 py-4">
                      {/* ── Time ── */}
                      <div className="w-16 shrink-0 text-right text-sm text-[var(--pw-color-text-muted)]">
                        {time}
                      </div>

                      {/* ── Timeline dot ── */}
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${icon.bgColor}`}
                        >
                          <Icon
                            className={`h-4 w-4 ${icon.iconColor}`}
                            aria-hidden={true}
                          />
                        </div>
                        {i < group.entries.length - 1 && (
                          <div className="mt-2 h-full w-px bg-[var(--pw-color-border-subtle)]" />
                        )}
                      </div>

                      {/* ── Content ── */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-[var(--pw-color-text-primary)]">
                            {entry.summary}
                          </h3>
                          <Badge variant="secondary" className="shrink-0">
                            {icon.label}
                          </Badge>
                        </div>
                        {entry.provenance?.source && (
                          <p className="mt-1 text-xs text-[var(--pw-color-text-muted)]">
                            via {entry.provenance.source}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* ── Add Entry Modal ── */}
      {showComposer && (
        <AddEntryModal
          onClose={() => setShowComposer(false)}
          onSaved={() => {
            setShowComposer(false);
            bumpJournal();
          }}
        />
      )}

      {/* ── Entry Detail Modal ── */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}

// ── Add Entry Modal ──

function AddEntryModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveJournalEntry(text.trim());
      setSuccess(true);
        setTimeout(() => { onSaved(); }, 1500);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "Could not connect to the server.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between p-4">
          <h2
            className="text-lg font-semibold text-[var(--pw-color-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
          >
            Add Journal Entry
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What happened? What did you observe?"
              rows={4}
              maxLength={2000}
              className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-3 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)] resize-none"
              aria-label="Journal entry text"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--pw-color-text-muted)]">
                {text.length}/2000 {text.length > 1800 && "(close to limit)"}
              </span>
              {error && (
                <p className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>
              )}
            </div>
          </CardContent>
          <div className="flex justify-end gap-2 p-4 pt-0">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim() || isSaving || success}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 loader-static" />
              ) : success ? (
                "✓ Saved"
              ) : (
                "Save Entry"
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Entry Detail Modal ──

function EntryDetailModal({
  entry,
  onClose,
}: {
  entry: JournalEntry;
  onClose: () => void;
}) {
  const icon = getJournalIcon(entry.kind, entry.summary);
  const Icon = icon.icon;
  const date = new Date(entry.ts);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${icon.bgColor}`}
            >
              <Icon className={`h-5 w-5 ${icon.iconColor}`} aria-hidden={true} />
            </div>
            <div>
              <Badge variant="secondary">{icon.label}</Badge>
              <p className="mt-1 text-xs text-[var(--pw-color-text-muted)]">
                {date.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at{" "}
                {date.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <CardContent>
          <p className="text-[var(--pw-color-text-primary)]">{entry.summary}</p>
          {entry.provenance?.source && (
            <p className="mt-3 text-xs text-[var(--pw-color-text-muted)]">
              Recorded by {entry.provenance.source}
            </p>
          )}
        </CardContent>
        <div className="flex justify-end p-4 pt-0">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Helpers ──

function groupByDate(
  entries: JournalEntry[]
): Array<{ label: string; entries: JournalEntry[] }> {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  const groups: Record<string, JournalEntry[]> = {};

  for (const entry of entries) {
    const date = new Date(entry.ts);
    const dateStr = date.toDateString();

    let label: string;
    if (dateStr === today) {
      label = "Today";
    } else if (dateStr === yesterday) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  return Object.entries(groups).map(([label, entries]) => ({
    label,
    entries,
  }));
}

function formatTime(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getJournalIcon(
  kind: string,
  summary: string
): {
  icon: typeof CheckCircle2;
  iconColor: string;
  bgColor: string;
  label: string;
} {
  const lower = (kind + " " + summary).toLowerCase();

  if (lower.includes("deploy") || lower.includes("completed") || lower.includes("shipped")) {
    return {
      icon: CheckCircle2,
      iconColor: "text-[var(--pw-color-accent-secondary)]",
      bgColor: "bg-[var(--pw-color-accent-secondary)]/10",
      label: "deployment",
    };
  }
  if (lower.includes("setting") || lower.includes("config") || lower.includes("updated")) {
    return {
      icon: Settings,
      iconColor: "text-[var(--pw-color-text-muted)]",
      bgColor: "bg-[var(--pw-color-surface-elevated)]",
      label: "settings",
    };
  }
  if (lower.includes("health") || lower.includes("check") || lower.includes("passed")) {
    return {
      icon: Heart,
      iconColor: "text-[var(--pw-color-accent-secondary)]",
      bgColor: "bg-[var(--pw-color-accent-secondary)]/10",
      label: "health",
    };
  }
  if (lower.includes("doc") || lower.includes("readme") || lower.includes("security")) {
    return {
      icon: FileText,
      iconColor: "text-[var(--pw-color-accent-primary)]",
      bgColor: "bg-[var(--pw-color-accent-primary)]/10",
      label: "documentation",
    };
  }
  if (lower.includes("observ") || lower.includes("record") || lower.includes("note")) {
    return {
      icon: GitCommit,
      iconColor: "text-[var(--pw-color-accent-secondary)]",
      bgColor: "bg-[var(--pw-color-accent-secondary)]/10",
      label: "observation",
    };
  }

  return {
    icon: BookOpen,
    iconColor: "text-[var(--pw-color-text-muted)]",
    bgColor: "bg-[var(--pw-color-surface-elevated)]",
    label: kind || "note",
  };
}

export default JournalScreen;
