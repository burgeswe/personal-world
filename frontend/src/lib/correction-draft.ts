/**
 * Assistant-draft handoff (chat → journal): the smallest existing
 * seam for "Prepare correction". ChatPanel stays context-free; the
 * host stash()es the draft in sessionStorage and navigates to
 * /journal?correct=<entry_ts>; JournalScreen take()s exactly one
 * draft (or null) when it opens the correction panel. The draft is a
 * UI convenience ONLY — it is never sent anywhere until the human
 * approves it through the existing supersede endpoint, and it carries
 * its provenance label so the panel can say who drafted it.
 */
import type { ChatJournalCorrectionProposal } from "./api";

const KEY = "pw_correction_draft";

export interface CorrectionDraft {
  entry_ts: string;
  proposed_text: string;
  reason: string;
}

export function stashCorrectionDraft(
  proposal: ChatJournalCorrectionProposal
): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        entry_ts: proposal.entry_ts,
        proposed_text: proposal.proposed_text,
        reason: proposal.reason,
      } satisfies CorrectionDraft)
    );
  } catch {
    // Storage may be full or blocked; navigation still happens and the
    // Journal panel opens empty — a lost convenience, never a lie.
  }
}

export function takeCorrectionDraft(): CorrectionDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<CorrectionDraft>;
    if (
      typeof parsed.entry_ts === "string" &&
      typeof parsed.proposed_text === "string" &&
      typeof parsed.reason === "string"
    ) {
      return {
        entry_ts: parsed.entry_ts,
        proposed_text: parsed.proposed_text,
        reason: parsed.reason,
      };
    }
    return null;
  } catch {
    return null;
  }
}