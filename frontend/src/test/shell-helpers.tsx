import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";
import { CompanionProvider } from "../lib/companion-context";
import {
  PrefsProvider,
  PREFERENCES_DEFAULTS,
} from "../lib/prefs-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import type { SectionData } from "../lib/api";

/**
 * Shared shell-test helpers (T9). All shell specs render through
 * providers that mirror the real app tree (Companion, Prefs,
 * LiveRegion) and a MemoryRouter so NavLinks resolve.
 */

export function shellProviders(ui: ReactElement, options: Omit<RenderOptions, "wrapper"> = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/"]}>
        <CompanionProvider>
          <PrefsProvider>
            <LiveRegionProvider>{children}</LiveRegionProvider>
          </PrefsProvider>
        </CompanionProvider>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

/** Section payload shape exactly as GET /api/sections returns it
 * (api.py §2 handlers; tests/test_sections.py asserts this key set). */
export const SECTIONS_ENVELOPE_KEYS = [
  "id",
  "label",
  "icon",
  "order",
  "visible",
  "pinned",
  "kind",
  "configured",
  "status",
] as const;

export function section(overrides: Partial<SectionData> = {}): SectionData {
  return {
    id: "today",
    label: "Today",
    icon: "navigation--today",
    order: 0,
    visible: true,
    pinned: false,
    kind: "core",
    configured: true,
    status: null,
    ...overrides,
  };
}

/** The default registry payload (server defaults, spec §2.1/§2.3). */
export const DEFAULT_SECTIONS: SectionData[] = [
  section(),
  section({
    id: "interests",
    label: "Interests",
    icon: "world-content--bookmark",
    order: 1,
    configured: false,
    status: "not_configured",
  }),
  section({
    id: "media",
    label: "Media",
    icon: "world-content--story",
    order: 2,
    configured: false,
    status: "not_configured",
  }),
  section({
    id: "projects",
    label: "Projects",
    icon: "navigation--projects",
    order: 3,
    status: "not_configured",
    configured: false,
  }),
  section({
    id: "lab",
    label: "Lab",
    icon: "system-device--desktop",
    order: 4,
    configured: false,
    status: "not_configured",
  }),
  section({
    id: "journal",
    label: "Journal & Memory",
    icon: "navigation--journal",
    order: 5,
  }),
  section({
    id: "vault",
    label: "Vault",
    icon: "system-device--lock",
    order: 6,
  }),
  section({
    id: "chat",
    label: "Chat",
    icon: "navigation--chat",
    order: 7,
    kind: "transitional",
  }),
  section({
    id: "settings",
    label: "Settings",
    icon: "navigation--settings",
    order: 8,
    pinned: true,
  }),
];

export { PREFERENCES_DEFAULTS };