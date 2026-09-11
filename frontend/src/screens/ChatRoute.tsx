import { ChatPanel } from "../components/ChatPanel";
import { COMPANIONS, useCompanion } from "../lib/companion-context";

/**
 * Chat route (P1 T12, FOUNDATION-SPEC §6): transitional standalone
 * Chat. The route file contains NO chat logic — it only mounts the
 * ChatPanel component (the same component the World Assistant Drawer
 * hosts in P4, §6 transition rule). The h1 lives on the route (one
 * visible h1 per page, A11y §4.1); ChatPanel owns the h2 conversation
 * structure so it stays heading-correct inside a drawer too.
 */
function ChatRoute() {
  const { companion } = useCompanion();
  const comp = COMPANIONS[companion] ?? COMPANIONS["personal-world"];
  return (
    <section aria-labelledby="chat-heading" className="pw-chat-route">
      <h1
        id="chat-heading"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        Chat
      </h1>
      <ChatPanel companionIcon={comp.icon} />
    </section>
  );
}

export default ChatRoute;