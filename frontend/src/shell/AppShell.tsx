import { useEffect, useState, type ReactNode } from "react";
import { SectionNav } from "./SectionNav";
import { Drawer } from "../primitives/Drawer";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { ChatPanel } from "../components/ChatPanel";

/**
 * AppShell (P1 T9, FOUNDATION-SPEC §5 shell components, A11y §2.6/§4.2/
 * §5.1): the single application frame.
 *
 * Semantic source order (A11y §5.1): skip link FIRST in tab order, then
 * the navigation ("Main"), then main#main-content, then the World
 * Assistant Drawer (non-modal complementary, A11y §3.2 desktop; the
 * Drawer primitive becomes a modal bottom sheet <600px).
 *
 * The shell owns `<main id="main-content">`: route content mounts
 * inside it as plain children (T7/T8 landmark tests render this shape).
 * Prototype screens (T10–T12 redesign) keep their existing markup but
 * no longer re-declare the landmark.
 *
 * Header geometry (T14 human gate 1): a FIXED compact brand strip —
 * brand wordmark + assistant trigger — with identical height on every
 * route; the banner bucket may wrap its nav taller (bucket-driven,
 * never route-driven). The assistant trigger's companion artwork is
 * aria-hidden (A11y §7.2/7.3) and the trigger's ONLY accessible name
 * is "Open World assistant" (the CompanionSlot sibling contract).
 *
 * Companion hierarchy (finding D): exactly ONE persistent companion in
 * the shell — the assistant trigger's artwork. The brand lockup is the
 * wordmark only; page companions appear only in empty/error states.
 *
 * World Assistant (T14 human gate 5): the existing ChatPanel (T12,
 * context-free by design) hosted in the Drawer primitive with heading
 * "World Assistant". Escape closes, focus returns to the trigger, the
 * background stays interactive (Drawer contract, A11y §3.1). The /chat
 * route remains the transitional standalone surface (parity row 7).
 *
 * Responsive cascade (spec §5, RESPONSIVE_RULES):
 *   ≥900px        left nav rail (icon-over-label)
 *   600–899px     top banner with horizontal links
 *   <600px        fixed bottom bar with env(safe-area-inset-bottom)
 *
 * Exactly ONE nav landmark exists per viewport bucket: the bucket is
 * mirrored from the CSS media queries (same strings, so the responsive
 * seam spec asserts component truth against CSS truth), and CSS seams
 * restate each slot's visibility as defense in depth. Navigation stays
 * before main in DOM order at every breakpoint (A11y §5.4: CSS never
 * repairs DOM order). Targets are ≥44px via --pw-target-minimum.
 */

/** Test seam for the cascade: viewport buckets, mirrored from CSS. */
export type ShellViewport = "rail" | "banner" | "bottom";

const RAIL_QUERY = "(min-width: 900px)";
const BANNER_QUERY = "(min-width: 600px) and (max-width: 899px)";
const BOTTOM_QUERY = "(max-width: 599px)";

export function viewportBucket(): ShellViewport {
  if (typeof window.matchMedia !== "function") return "rail"; // jsdom/desktop default
  if (window.matchMedia(RAIL_QUERY).matches) return "rail";
  if (window.matchMedia(BANNER_QUERY).matches) return "banner";
  return "bottom";
}

function useViewportBucket(): ShellViewport {
  const [bucket, setBucket] = useState<ShellViewport>(() => viewportBucket());
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const onChange = () => setBucket(viewportBucket());
    const mqls = [RAIL_QUERY, BANNER_QUERY, BOTTOM_QUERY].map((q) =>
      window.matchMedia(q)
    );
    mqls.forEach((mql) => mql.addEventListener("change", onChange));
    onChange();
    return () => mqls.forEach((mql) => mql.removeEventListener("change", onChange));
  }, []);
  return bucket;
}

export interface AppShellProps {
  /**
   * Route content; rendered INSIDE the shell-owned
   * `<main id="main-content">` (the skip-link target).
   */
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const bucket = useViewportBucket();
  // Local state only (T14 human gate 5): open/closed for the World
  // Assistant Drawer. No new context or global machinery.
  const [assistantOpen, setAssistantOpen] = useState(false);
  const openAssistant = () => setAssistantOpen(true);
  const closeAssistant = () => setAssistantOpen(false);

  return (
    <div className="pw-shell" data-pw-nav={bucket}>
      {/* A11y §2.6: skip link is the first focusable element. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="pw-header">
        {/* Brand wordmark only (finding D): the header's persistent
            companion belonged to the brand lockup AND the assistant
            trigger AND empty states; the hierarchy keeps exactly ONE
            shell companion — the assistant's — so the brand is calm
            text. The lockup wrapper keeps the wordmark's layout seam. */}
        <span className="pw-brand-lockup">
          <span
            className="pw-brand"
            style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
          >
            Personal World
          </span>
        </span>
        {bucket === "banner" ? (
          <nav aria-label="Main" className="pw-banner-nav">
            <SectionNav />
          </nav>
        ) : null}
        {/* Assistant trigger (A11y §3.2/§7.2): visible on every route;
            the ONLY accessible name is "Open World assistant". */}
        <span className="pw-header-end">
          <CompanionSlot
            size="nav"
            asAssistantTrigger
            onOpenAssistant={openAssistant}
          />
        </span>
      </header>

      {/* The single Main nav: rail slot ≥900px, bottom bar <600px. Both
          stay before main in DOM order; CSS owns visibility per bucket. */}
      {bucket === "rail" ? (
        <nav aria-label="Main" className="pw-rail">
          <SectionNav compact />
        </nav>
      ) : null}
      {bucket === "bottom" ? (
        <nav aria-label="Main" className="pw-bottom-bar">
          <SectionNav compact />
        </nav>
      ) : null}

      {/* A11y §4.2: exactly one main landmark, the skip-link target. */}
      <main id="main-content" className="pw-main">
        {children}
      </main>

      {/* World Assistant (T14 human gate 5, A11y §3.2): the T12
          ChatPanel in the T8 Drawer — non-modal side drawer on desktop,
          modal bottom sheet below 600px (A11y §3.5). The Drawer
          supplies the contract heading "World Assistant"; ChatPanel
          keeps its own h2 conversation structure beneath it.
          ChatPanel is context-free by design — hosted here without
          router deps; the /chat route stays as the standalone surface. */}
      <Drawer
        open={assistantOpen}
        title="World Assistant"
        onClose={closeAssistant}
        side={bucket === "bottom" ? "bottom" : "right"}
      >
        <ChatPanel />
      </Drawer>
    </div>
  );
}