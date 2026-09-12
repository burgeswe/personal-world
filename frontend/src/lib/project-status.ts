/**
 * Project-status categorization shared by Projects and Today: the
 * agent-sync estate vocabulary as Project Worlds presents it.
 *
 * agent-sync stays authoritative for the observation; these helpers
 * only classify what it already computed — no Git logic lives here.
 * The five categories are deliberately distinct: collapsing them
 * into one "warning" would hide the difference between "you have
 * local work" (calm) and "histories diverged" (needs the person).
 */

import type { AgentSyncProject } from "./api";

export type ProjectCategory =
  | "quiet"
  | "local_work"
  | "unpublished"
  | "diverged"
  | "unknown";

export function projectCategory(p: AgentSyncProject): ProjectCategory {
  if (p.publish_state === "diverged") return "diverged";
  if (p.publish_state === "ahead" || p.publish_state === "behind") {
    return "unpublished";
  }
  if (p.publish_state === null) return "unknown";
  // published (match): is there local work?
  const tree = p.working_tree;
  const dirty =
    tree.staged + tree.modified + tree.untracked + tree.conflicted;
  return dirty > 0 ? "local_work" : "quiet";
}

/** Attention priority (handoff model): diverged first, then
 *  unpublished; remote-unknown next; published-with-local-work is
 *  deliberately LOW urgency — ordinary development is never alarm. */
export const CATEGORY_ORDER: Record<ProjectCategory, number> = {
  diverged: 0,
  unpublished: 1,
  unknown: 2,
  local_work: 3,
  quiet: 4,
};

/** The categories that genuinely need the person now. */
export const NEEDS_ATTENTION: ProjectCategory[] = ["diverged", "unpublished"];

/** One plain-language sentence per project that is NOT quiet. No raw
 *  Git terms without their human meaning; no suggested commands
 *  (explaining is not authorizing). */
export function projectSentence(p: AgentSyncProject): string | null {
  const cat = projectCategory(p);
  switch (cat) {
    case "diverged":
      return `${p.project}: local and remote histories have diverged — both sides have work the other doesn't have.`;
    case "unpublished":
      if (p.publish_state === "ahead") {
        return `${p.project}: local work is not published yet — the remote hasn't seen your latest commits.`;
      }
      return `${p.project}: the remote has newer history than this copy.`;
    case "local_work":
      return `${p.project}: published state is safe; local work is still in progress.`;
    case "unknown":
      return `${p.project}: the remote could not be reached, so publication state is unknown.`;
    default:
      return null; // quiet projects get no sentence (calm summary)
  }
}