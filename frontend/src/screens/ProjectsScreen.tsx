import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../shell/EmptyState";
import { ErrorState } from "../shell/ErrorState";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { useSourceControlStatus, useSourceControlHistory } from "../lib/hooks";
import { Loader2 } from "../lib/icons";
import type { SourceControlRepo } from "../lib/api";

/**
 * ProjectsScreen (Finish Line "Projects workspace", first vertical
 * slice): the real repository table from GET /api/source-control/status
 * (the native git baseline), with per-repo provenance and recent
 * history from GET /api/source-control/history.
 *
 * Presentation-only truth, exactly as the backend reports it:
 * - one row per discovered repository (name, branch, ahead/behind,
 *   dirty, last commit) — never invented, never dropped;
 * - per-repo provenance behind a Disclosure (path, revision, remote,
 *   structured error if git could not answer);
 * - selecting a repo loads its recent commits (the "repository and
 *   branch state" row of the Finish Line's project surface);
 * - absent capability (no search_paths configured) keeps the honest
 *   EmptyState naming the knob (HRC explicit state; plan C-2). No
 *   mount path leaks into copy — the knob names the documented
 *   config (source_control.search_paths), not a filesystem path.
 *
 * Context-aware assistant: the shell tells the assistant this is
 * Projects; no per-repo selection is pushed into chat yet (that is a
 * later slice — the context envelope supports it via route/section).
 */

/** Canonical-status guard: statuses outside status.py render as unknown. */
function repoStatusChip(r: SourceControlRepo): "healthy" | "warning" | "unavailable" | "unknown" {
  if (r.error) return "unavailable";
  if (r.dirty === true) return "warning";
  if (r.branch === null && r.revision === null) return "unknown";
  return "healthy";
}

function relativeCommitDate(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return null;
  const diffMs = Date.now() - ts.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** One repo's recent history, loaded when its row is expanded. */
function RepoHistory({ repo }: { repo: string }) {
  const history = useSourceControlHistory(repo, 5);
  if (history.isLoading) {
    return (
      <p className="text-sm text-[var(--pw-color-text-secondary)] mt-2">
        <Loader2 size={14} aria-hidden={true} className="pw-spin" /> Loading
        recent commits…
      </p>
    );
  }
  if (history.isError) {
    return (
      <p className="text-sm text-[var(--pw-color-text-secondary)] mt-2">
        Recent commits could not be loaded. The table above still works.
      </p>
    );
  }
  const commits = history.data?.commits ?? [];
  if (commits.length === 0) {
    return (
      <p className="text-sm text-[var(--pw-color-text-secondary)] mt-2">
        No commits recorded for this repository yet.
      </p>
    );
  }
  return (
    <ol className="mt-2 space-y-1 text-sm" data-pw-projects-history={repo}>
      {commits.map((c) => (
        <li key={c.revision}>
          <span className="text-[var(--pw-color-text-primary)]">{c.subject}</span>
          <span className="text-[var(--pw-color-text-secondary)]">
            {" "}
            — {c.author}, {relativeCommitDate(c.date) ?? c.date}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function ProjectsScreen() {
  const query = useSourceControlStatus();
  // Selected repo = ?repo=<name> (shareable, refresh-stable); no extra
  // state — the URL IS the selection. The assistant context below reads
  // the same value the drill-in shows.
  const [searchParams, setSearchParams] = useSearchParams();
  const openRepo = searchParams.get("repo");
  const setOpenRepo = (name: string | null) => {
    setSearchParams(name ? { repo: name } : {}, { replace: true });
  };

  if (query.isLoading) {
    return (
      <div data-pw-projects="loading">
        <EmptyState
          title="Projects"
          headingLevel={1}
          capability="Projects follow your repositories and their recent activity."
          knob="This appears for a moment while repository status loads."
        />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as Error | null;
    return (
      <div data-pw-projects="error">
        <ErrorState
          title="Projects"
          headingLevel={1}
          failed="could not load repository status"
          detail={error instanceof Error ? error.message : null}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const envelope = query.data ?? null;
  // apiFetchEnvelope keeps {ok, status, data}: ok:false / not_configured
  // (no search paths configured) degrades to the honest EmptyState
  // naming the knob — never fabricated repos.
  const repos = envelope?.data?.repos ?? null;
  if (!envelope || envelope.ok === false || !Array.isArray(repos)) {
    return (
      <div data-pw-projects="absent">
        <EmptyState
          title="Projects"
          headingLevel={1}
          capability="Projects follow your repositories and their recent activity."
          knob="List repository locations under Source Control in Settings to enable this section."
        />
      </div>
    );
  }

  const list = repos;
  const dirtyCount = list.filter((r) => r.dirty === true).length;
  const aheadCount = list.filter((r) => (r.ahead ?? 0) > 0).length;

  return (
    <section aria-labelledby="projects-heading" data-pw-projects="table">
      <h1 id="projects-heading">Projects</h1>

      {/* Level-1 glance: one quiet line (attention contract: healthy
          machinery stays quiet; only the counts that matter surface). */}
      <p>
        {list.length === 1
          ? "1 repository watched"
          : `${list.length} repositories watched`}
        {dirtyCount > 0 ? ` — ${dirtyCount} with uncommitted changes` : ""}
        {aheadCount > 0 ? ` — ${aheadCount} ahead of remote` : ""}
        {dirtyCount === 0 && aheadCount === 0 && list.length > 0
          ? " — everything clean"
          : ""}
      </p>

      {list.length === 0 ? (
        <p data-pw-projects="empty">
          Repository locations are configured, but no repositories were
          found at them yet.
        </p>
      ) : (
        <table
          data-pw-projects-table="repos"
          className="w-full text-left text-sm"
        >
          <caption className="sr-only">
            Repositories with branch state and per-row provenance
          </caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 pr-4">Repository</th>
              <th scope="col" className="py-2 pr-4">Branch</th>
              <th scope="col" className="py-2 pr-4">Last commit</th>
              <th scope="col" className="py-2">State</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const chip = repoStatusChip(r);
              const isOpen = openRepo === r.name;
              return (
                <tr
                  key={r.name}
                  data-pw-projects-row={r.name}
                  className="border-t border-[var(--pw-color-border-subtle)]"
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="text-left rounded-md px-2 py-1 -mx-2 text-[var(--pw-color-text-primary)] underline decoration-[var(--pw-color-border-subtle)] underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-[var(--pw-color-focus-ring)]"
                      aria-expanded={isOpen}
                      onClick={() => {
                        setOpenRepo(isOpen ? null : r.name);
                      }}
                    >
                      {r.name}
                    </button>
                  </th>
                  <td>{r.branch ?? "—"}</td>
                  <td>
                    {r.last_commit_subject
                      ? `${r.last_commit_subject} (${relativeCommitDate(r.last_commit_date) ?? r.last_commit_date})`
                      : "no commits yet"}
                  </td>
                  <td>
                    <ul className="list-disc ml-4 text-[var(--pw-color-text-secondary)]">
                      {r.error ? (
                        <li data-pw-projects-state="error">{r.error}</li>
                      ) : null}
                      {r.dirty === true ? <li>uncommitted changes</li> : null}
                      {typeof r.ahead === "number" && r.ahead > 0 ? (
                        <li>{r.ahead} ahead of remote</li>
                      ) : null}
                      {typeof r.behind === "number" && r.behind > 0 ? (
                        <li>{r.behind} behind remote</li>
                      ) : null}
                      {r.error || r.dirty === true ? null : <li>clean</li>}
                    </ul>
                    <span data-pw-projects-chip={chip} className="sr-only">
                      Status: {chip}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Selected-repo detail: recent commits + provenance. Exactly one
          expanded repo at a time keeps the default view calm. */}
      {openRepo ? (
        <div data-pw-projects-detail={openRepo} className="mt-4 space-y-2">
          <Disclosure
            summary={`Recent commits — ${openRepo}`}
            level={2}
            defaultOpen
          >
            <RepoHistory repo={openRepo} />
          </Disclosure>
          {(() => {
            const repo = list.find((r) => r.name === openRepo);
            if (!repo) return null;
            return (
              <Disclosure summary="Repository details" level={2}>
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[var(--pw-color-text-secondary)]">Path</dt>
                    <dd>{repo.path}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--pw-color-text-secondary)]">Revision</dt>
                    <dd>{repo.revision ?? "unknown"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--pw-color-text-secondary)]">Remote</dt>
                    <dd>{repo.remote ?? "none configured"}</dd>
                  </div>
                </dl>
                {repo.error ? (
                  <p className="text-sm text-[var(--pw-color-text-secondary)]">{repo.error}</p>
                ) : null}
              </Disclosure>
            );
          })()}
        </div>
      ) : null}

      {/* Every-repo provenance stays available (nerd mode) without
          cluttering the default view: one collapsed disclosure. */}
      <Disclosure summary="All repository details" level={2}>
        <ul className="mt-2 space-y-2">
          {list.map((r) => (
            <li key={r.name}>
              <TechnicalDetails
                provider={`git · ${r.name}`}
                raw={JSON.stringify(r, null, 2)}
              />
            </li>
          ))}
        </ul>
      </Disclosure>
    </section>
  );
}