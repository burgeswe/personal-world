import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../shell/EmptyState";
import { ErrorState } from "../shell/ErrorState";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { useSourceControlStatus, useSourceControlHistory, useSourceControlEnrichment, useAgentSyncProjects } from "../lib/hooks";
import { Loader2 } from "../lib/icons";
import { refreshSourceControlStatus, type SourceControlRepo, type SourceControlEnrichment } from "../lib/api";
import { projectCategory, projectSentence, CATEGORY_ORDER, type ProjectCategory } from "../lib/project-status";
import { useAnnounce } from "../primitives/LiveRegion";

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


/**
 * RepoRefreshApproval (first propose→approve→act workflow; Finish
 * Line "Actions, approvals, and trusted automation"):
 *
 * PROPOSE → the Projects screen proposes a read-only status re-check
 * for the selected repo and explains WHAT will happen, WHY, WHICH tool,
 * the RISK LEVEL, and the EXPECTED RESULT — all in plain language.
 *
 * APPROVAL BOUNDARY — agreement is not authorization: nothing runs
 * until the person presses "Approve and refresh". No timer, no
 * auto-approve, no assistant shortcut around it.
 *
 * ACT → one POST /api/source-control/refresh (step-up header; the
 * backend journals the audit answer).
 *
 * RESULT → the outcome is explicit: nothing has happened yet, the
 * refresh is running, it finished with what came back, or it failed
 * with why. Repeated use re-proposes fresh (state resets to "not
 * happened yet" on each new proposal). Inline — no modal trap.
 */
type RefreshState =
  | { phase: "proposed" }
  | { phase: "running" }
  | { phase: "done"; ok: boolean; detail: string }
  | { phase: "failed"; detail: string };

export function RepoRefreshApproval({
  repo,
  onRefreshed,
}: {
  repo: string;
  onRefreshed: () => void;
}) {
  const { announce } = useAnnounce();
  const [state, setState] = useState<RefreshState>({ phase: "proposed" });

  const approve = async () => {
    if (state.phase === "running") return;
    setState({ phase: "running" });
    try {
      const env = await refreshSourceControlStatus(repo);
      if (env.ok && env.data) {
        const st = env.data.status;
        const bits: string[] = [`branch ${st.branch ?? "unknown"}`];
        bits.push(st.dirty ? "has uncommitted changes" : "is clean");
        if (st.ahead || st.behind) {
          bits.push(`${st.ahead ?? 0} ahead / ${st.behind ?? 0} behind remote`);
        }
        setState({ phase: "done", ok: true, detail: bits.join(", ") });
        announce("Repository status refreshed.", {
          kind: "action_completed",
          key: "repo-refresh",
        });
        onRefreshed();
      } else {
        setState({
          phase: "failed",
          detail: env.warnings?.[0] ?? "The refresh could not complete.",
        });
        announce("Repository status refresh failed.", {
          kind: "error",
          key: "repo-refresh",
        });
      }
    } catch {
      setState({
        phase: "failed",
        detail: "The refresh could not complete. Nothing else changed.",
      });
      announce("Repository status refresh failed.", {
        kind: "error",
        key: "repo-refresh",
      });
    }
  };

  return (
    <section
      aria-labelledby="repo-refresh-heading"
      data-pw-refresh={state.phase}
      className="mt-2 rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-4"
    >
      <h3 id="repo-refresh-heading" className="text-base font-semibold">
        Refresh repository status
      </h3>
      {/* WHAT / WHY / TOOL / RISK / EXPECTED — plain, short, no color-only
          meaning. Explicit has/has-not-happened on every phase. */}
      {state.phase === "proposed" ? (
        <>
          <p className="mt-1 text-sm text-[var(--pw-color-text-secondary)]">
            Re-check <strong>{repo}</strong> for its current branch,
            uncommitted changes, and ahead/behind counts.
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-[var(--pw-color-text-secondary)]">
            <li>Why: the status shown may be from an earlier look.</li>
            <li>Uses: the built-in git status reader. Nothing is written.</li>
            <li>Risk: low — read-only and reversible.</li>
            <li>Expected: fresh branch and change state, recorded in your journal.</li>
          </ul>
          <p className="mt-2 text-sm">
            Nothing has happened yet. Only your approval runs it.
          </p>
          <button
            type="button"
            data-pw-refresh-approve
            onClick={() => void approve()}
            className="mt-2 inline-flex min-h-[var(--pw-target-minimum)] items-center rounded-lg border border-[var(--pw-color-border-subtle)] px-4 text-sm font-medium text-[var(--pw-color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2"
          >
            Approve and refresh
          </button>
        </>
      ) : state.phase === "running" ? (
        <p className="mt-1 text-sm" role="status">
          Refreshing {repo} now — this usually takes a moment…
        </p>
      ) : state.phase === "done" ? (
        <>
          <p className="mt-1 text-sm" role="status">
            Done — {repo} re-checked: {state.detail}.
          </p>
          <p className="mt-1 text-xs text-[var(--pw-color-text-secondary)]">
            Recorded in your journal with full provenance.
          </p>
          <button
            type="button"
            onClick={() => setState({ phase: "proposed" })}
            className="mt-2 inline-flex min-h-[var(--pw-target-minimum)] items-center rounded-lg border border-[var(--pw-color-border-subtle)] px-4 text-sm text-[var(--pw-color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2"
          >
            Refresh again
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm" role="status">
            The refresh did not finish: {state.detail}
          </p>
          <button
            type="button"
            onClick={() => setState({ phase: "proposed" })}
            className="mt-2 inline-flex min-h-[var(--pw-target-minimum)] items-center rounded-lg border border-[var(--pw-color-border-subtle)] px-4 text-sm text-[var(--pw-color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2"
          >
            Back to the proposal
          </button>
        </>
      )}
    </section>
  );
}

/** GitHub enrichment for the selected repo: remote facts local Git
 *  cannot know, presented with per-field provenance. Optional by
 *  contract — every degraded state renders as one quiet sentence and
 *  never affects the native table above. */
function RepoEnrichment({ repo }: { repo: string }) {
  const enrichment = useSourceControlEnrichment(repo);
  if (enrichment.isLoading) {
    return (
      <p data-pw-projects-enrichment="loading" className="text-sm text-[var(--pw-color-text-secondary)]">
        Checking GitHub for remote activity…
      </p>
    );
  }
  if (enrichment.isError || !enrichment.data) {
    return (
      <p data-pw-projects-enrichment="absent" className="text-sm text-[var(--pw-color-text-secondary)]">
        GitHub information is not available right now. Everything local still works.
      </p>
    );
  }
  const env = enrichment.data;
  // A payload without enrichment fields (or an unexpected shape) is an
  // honest absent — never a crash, never guessed fields.
  const data =
    env && env.ok && env.data && "slug" in env.data
      ? (env.data as SourceControlEnrichment)
      : null;
  if (!env.ok || !data) {
    const reason =
      env.status === "not_github"
        ? "This repository's remote is not on GitHub, so there is nothing to add from there."
        : env.status === "not_configured"
          ? "GitHub information needs the repository to be in your configured locations."
          : "GitHub information is not available right now. Everything local still works.";
    return (
      <p data-pw-projects-enrichment="absent" className="text-sm text-[var(--pw-color-text-secondary)]">
        {reason}
      </p>
    );
  }
  return (
    <div data-pw-projects-enrichment="healthy" className="text-sm">
      <p className="text-[var(--pw-color-text-secondary)]">
        From GitHub{" "}
        {data.url ? (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[var(--pw-color-border-subtle)] underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2 rounded-sm"
          >
            {data.slug}
          </a>
        ) : (
          data.slug
        )}
        :
      </p>
      <dl className="grid gap-2 mt-1 sm:grid-cols-2">
        <div>
          <dt className="text-[var(--pw-color-text-secondary)]">Open pull requests</dt>
          <dd>{data.open_prs === null ? "unknown" : data.open_prs}</dd>
        </div>
        <div>
          <dt className="text-[var(--pw-color-text-secondary)]">Open issues</dt>
          <dd>{data.open_issues === null ? "unknown" : data.open_issues}</dd>
        </div>
        <div>
          <dt className="text-[var(--pw-color-text-secondary)]">Remote default branch</dt>
          <dd>{data.default_branch ?? "unknown"}</dd>
        </div>
        <div>
          <dt className="text-[var(--pw-color-text-secondary)]">Last remote push</dt>
          <dd>{data.pushed_at ? relativeCommitDate(data.pushed_at) ?? data.pushed_at : "unknown"}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Project status (agent-sync estate sensor): the five summary
 * categories live in lib/project-status.ts (shared with Today);
 * the panel below is the Projects presentation — calm glance,
 * per-project sentences, technical guts behind a disclosure.
 */

/** The estate panel: agent-sync's own summary level — one calm
 *  glance line (only categories that exist), then per-project
 *  human sentences for everything not quiet, then the technical
 *  guts (SHAs, tree counts, safe-to-leave, Play-Nice, work state,
 *  observed time) behind a disclosure where they belong. */
function ProjectStatusPanel() {
  const query = useAgentSyncProjects();
  if (query.isLoading && !query.data) {
    return (
      <p data-pw-projects-status="loading" className="text-sm text-[var(--pw-color-text-secondary)]">
        <Loader2 size={14} aria-hidden={true} className="pw-spin" /> Checking your
        projects with agent-sync…
      </p>
    );
  }
  if (query.isError || !query.data || query.data.ok === false) {
    return (
      <p data-pw-projects-status="absent" className="text-sm text-[var(--pw-color-text-secondary)]">
        Project status from agent-sync is not available right now. Everything
        else on this page still works.
      </p>
    );
  }
  const data = query.data?.ok === true ? query.data.data : null;
  if (!data || !Array.isArray(data.projects)) {
    return (
      <p data-pw-projects-status="absent" className="text-sm text-[var(--pw-color-text-secondary)]">
        Project status from agent-sync is not available right now. Everything
        else on this page still works.
      </p>
    );
  }
  const projects = data.projects;
  if (projects.length === 0) {
    return (
      <p data-pw-projects-status="empty" className="text-sm text-[var(--pw-color-text-secondary)]">
        agent-sync observes no projects yet — its project registry is empty.
      </p>
    );
  }
  const cats = projects.map(projectCategory);
  const count = (c: ProjectCategory) => cats.filter((x) => x === c).length;
  const needsAttention = count("diverged") + count("unpublished");
  const sentences = projects
    .map((p) => ({ p, sentence: projectSentence(p) }))
    .filter((x) => x.sentence !== null)
    .sort((a, b) =>
      CATEGORY_ORDER[projectCategory(a.p)] - CATEGORY_ORDER[projectCategory(b.p)]);

  // The calm glance: one composed sentence, only categories that
  // exist; "all settled" when nothing needs saying (attention
  // contract: quiet machinery is quiet; ordinary development is
  // never alarm).
  const bits: string[] = [];
  if (needsAttention > 0) {
    bits.push(
      needsAttention === 1 ? "1 needs attention" : `${needsAttention} need attention`
    );
  }
  if (count("local_work") > 0) {
    bits.push(
      count("local_work") === 1
        ? "1 has local work in progress"
        : `${count("local_work")} have local work in progress`
    );
  }
  if (count("unknown") > 0) {
    bits.push(
      count("unknown") === 1
        ? "1 could not reach its remote"
        : `${count("unknown")} could not reach their remotes`
    );
  }
  const quietCount = count("quiet");
  const glance =
    (quietCount > 0 ? `${quietCount} quiet — ` : "") + bits.join(" · ");
  if (bits.length === 0) {
    return (
      <section data-pw-projects-status="quiet" className="mt-4" aria-label="Project status">
        <p>
          {projects.length === 1
            ? "Your project is settled."
            : `All ${projects.length} projects are settled.`}
        </p>
        <p className="text-xs text-[var(--pw-color-text-secondary)]">
          {`Observed ${data.observed_at ? `at ${data.observed_at}` : "just now"} by agent-sync — a dated observation, not live truth.`}
        </p>
      </section>
    );
  }
  return (
    <section data-pw-projects-status="healthy" className="mt-4" aria-label="Project status">
      <p>{glance}</p>
      {sentences.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm" data-pw-projects-status-list>
          {sentences.map(({ p, sentence }) => (
            <li
              key={p.project}
              data-pw-projects-status-item={projectCategory(p)}
              className="text-[var(--pw-color-text-primary)]"
            >
              {sentence}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-[var(--pw-color-text-secondary)]">
        {`Observed ${data.observed_at ? `at ${data.observed_at}` : "just now"} by agent-sync — a dated observation, not live truth.`}
      </p>
      {/* Technical guts: exactly where they belong — one disclosure
          below the calm summary, never on the first glance. */}
      <Disclosure summary="Project details (technical)" level={2}>
        <ul className="mt-2 space-y-2">
          {[...projects]
            .sort((a, b) =>
              CATEGORY_ORDER[projectCategory(a)] - CATEGORY_ORDER[projectCategory(b)])
            .map((p) => {
              const tree = p.working_tree;
              return (
                <li key={p.project} data-pw-projects-guts={p.project}>
                  <TechnicalDetails
                    provider={`agent-sync · ${p.project}`}
                    raw={JSON.stringify(p, null, 2)}
                  />
                  <dl className="grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Publish state</dt>
                      <dd>{p.publish_state ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Safe to leave</dt>
                      <dd>{p.safe_to_leave}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Local head</dt>
                      <dd>{p.local_head?.slice(0, 7) ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Remote head</dt>
                      <dd>{p.remote_head?.slice(0, 7) ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Working tree</dt>
                      <dd>
                        {tree.staged} staged, {tree.modified} modified,{" "}
                        {tree.untracked} untracked, {tree.conflicted} conflicted
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Work state</dt>
                      <dd>{p.work_state}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Play-Nice</dt>
                      <dd>
                        {p.play_nice.present
                          ? `adopted${p.play_nice.revision ? ` @ ${p.play_nice.revision.slice(0, 7)}` : ""}`
                          : "not adopted"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pw-color-text-secondary)]">Observed</dt>
                      <dd>{data.observed_at ?? "unknown"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
        </ul>
      </Disclosure>
    </section>
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

  if (query.isLoading && !query.data) {
    // First load only: a refetch (e.g. after an approved refresh) must
    // never unmount the workflow result — the person would lose the
    // "what actually happened" answer the moment it arrived.
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

      {/* agent-sync estate status: Rylee's whole project world in
          five calm categories, one layer above the repo table. */}
      <ProjectStatusPanel />

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
          <RepoRefreshApproval
            repo={openRepo}
            onRefreshed={() => void query.refetch()}
          />
          <Disclosure
            summary={`Recent commits — ${openRepo}`}
            level={2}
            defaultOpen
          >
            <RepoHistory repo={openRepo} />
          </Disclosure>
          <Disclosure summary="GitHub activity" level={2} defaultOpen>
            {/* Remote enrichment (optional): one quiet disclosure that
                degrades to a single sentence when GitHub is absent.
                Local Git stays canonical; nothing here can affect the
                native rows above. */}
            <RepoEnrichment repo={openRepo} />
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