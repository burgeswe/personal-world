import { ChatPanel } from "../components/ChatPanel";
import { COMPANIONS, useCompanion } from "../lib/companion-context";
import { useNavigate } from "react-router-dom";
import { stashCorrectionDraft } from "../lib/correction-draft";
import type { ChatJournalCorrectionProposal } from "../lib/api";

/**
 * Chat route (P1 T12, FOUNDATION-SPEC §6): transitional standalone
 * Chat. The route file contains NO chat logic — it only mounts the
 * ChatPanel component (the same component the World Assistant Drawer
 * hosts in P4, §6 transition rule). The h1 lives on the route (one
 * visible h1 per page, A11y §4.1); ChatPanel owns the h2 conversation
 * structure so it stays heading-correct inside a drawer too.
 *
 * Assistant-drafted correction proposals (assistant participation):
 * "Prepare correction" stashes the draft and navigates to the
 * EXISTING Journal correction workflow (/journal?correct=<ts>) — a
 * pure navigation; the draft is UI state only, and nothing mutates
 * until the person approves it there.
 */
function ChatRoute() {
  const { companion } = useCompanion();
  const comp = COMPANIONS[companion] ?? COMPANIONS["personal-world"];
  const navigate = useNavigate();
  const onPrepareCorrection = (proposal: ChatJournalCorrectionProposal) => {
    stashCorrectionDraft(proposal);
    navigate(`/journal?correct=${encodeURIComponent(proposal.entry_ts)}`);
  };
  return (
    <section aria-labelledby="chat-heading" className="space-y-4">
      <h1
        id="chat-heading"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        Chat
      </h1>
      <ChatPanel
        companionIcon={comp.icon}
        onPrepareCorrection={onPrepareCorrection}
      />
    </section>
  );
}

export default ChatRoute;