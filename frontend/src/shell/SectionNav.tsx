import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import { useSections } from "../lib/hooks";
import { Icon, sectionIconToShimName } from "../lib/icons";
import type { SectionData } from "../lib/api";

/**
 * SectionNav (P1 T9, FOUNDATION-SPEC §5 shell): the main navigation,
 * rendered from GET /api/sections — never a hard-coded list.
 *
 * - Hidden sections are OMITTED from the nav (their routes still
 *   resolve: a direct URL to a hidden section renders honestly, §5/§10).
 * - The active item carries aria-current="page" (set as an attribute,
 *   not left to NavLink's runtime default).
 * - Items are ≥44px targets (--pw-target-minimum; the 56px preference
 *   enlarges via the server-side token, never shrinks below 44).
 * - Rail icons render at 24px with 0.8rem labels (T14 human gate 3,
 *   nav-presence legibility; targets stay ≥44px).
 * - Icons are sprite symbols via the local shim; a section icon id the
 *   sprite does not ship renders no icon rather than a broken glyph,
 *   and the label alone still names the destination (A11y §1.4: no
 *   information is icon-only).
 * - Renders one <ul> of links; AppShell places it in the rail / banner
 *   / bottom-bar slots, so this component stays layout-agnostic.
 */

function SectionNavLink({ section, compact }: { section: SectionData; compact: boolean }) {
  const shimName = sectionIconToShimName(section.icon);
  const to = section.id === "today" ? "/" : `/${section.id}`;
  return (
    <NavLink
      to={to}
      end={section.id === "today"}
      aria-current="page"
      className={({ isActive }) =>
        cn(
          "pw-nav-link",
          compact ? "pw-nav-link--rail" : "pw-nav-link--full",
          isActive && "pw-nav-link--active"
        )
      }
    >
      {shimName ? (
        <Icon
          name={shimName}
          size={compact ? 24 : 18}
          className="pw-nav-icon"
          aria-hidden={true}
        />
      ) : null}
      <span className="pw-nav-label">{section.label}</span>
    </NavLink>
  );
}

export interface SectionNavProps {
  items?: SectionData[];
  /** Rail form: icon over label, tighter width (≥900px rail). */
  compact?: boolean;
  className?: string;
}

export function SectionNav({ items, compact = false, className }: SectionNavProps) {
  const query = useSections();
  const sections = (items ?? query.data ?? []).filter((s) => s.visible);

  return (
    <ul className={cn("pw-nav-list", className)} role="list">
      {sections.map((section) => (
        <li key={section.id}>
          <SectionNavLink section={section} compact={compact} />
        </li>
      ))}
    </ul>
  );
}