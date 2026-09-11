import { useEffect, useState, type ReactNode } from "react";
import { SectionNav } from "./SectionNav";

/**
 * AppShell (P1 T9, FOUNDATION-SPEC §5 shell components, A11y §2.6/§4.2/
 * §5.1): the single application frame.
 *
 * Semantic source order (A11y §5.1): skip link FIRST in tab order, then
 * the navigation ("Main"), then main#main-content, then the Drawer
 * mount (which hosts the World Assistant's complementary Drawer, T12).
 *
 * The shell owns `<main id="main-content">`: route content mounts
 * inside it as plain children (T7/T8 landmark tests render this shape).
 * Prototype screens (T10–T12 redesign) keep their existing markup but
 * no longer re-declare the landmark.
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

  return (
    <div className="pw-shell" data-pw-nav={bucket}>
      {/* A11y §2.6: skip link is the first focusable element. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="pw-header">
        <span
          className="pw-brand"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          Personal World
        </span>
        {bucket === "banner" ? (
          <nav aria-label="Main" className="pw-banner-nav">
            <SectionNav />
          </nav>
        ) : null}
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

      {/* Drawer mount (future World Assistant, T12): a labeled mount
          point only — the Drawer primitive supplies its own complementary
          role and "World Assistant" heading when it is hosted here. */}
      <div id="pw-drawer-mount" data-pw-drawer-mount="world-assistant" />
    </div>
  );
}