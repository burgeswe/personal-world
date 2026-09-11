import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { fetchPrefs } from "./api";

interface CompanionContextType {
  companion: string;
  setCompanion: (id: string) => void;
}

const CompanionContext = createContext<CompanionContextType>({
  companion: "personal-world",
  setCompanion: () => {},
});

/**
 * T4: `localStorage["pw_companion"]` is no longer read or written —
 * companion truth is the server preference (GET /api/prefs), per
 * FOUNDATION-SPEC §1.2 (tracked repo / browser stores hold no truth).
 */
export function CompanionProvider({ children }: { children: ReactNode }) {
  const [companion, setCompanionState] = useState("personal-world");

  const setCompanion = (id: string) => {
    setCompanionState(id);
  };

  // Sync with API on mount — but never on the standalone auth routes
  // (T14): a pre-sign-in companion fetch is an unauthenticated /api
  // call (401 noise, half-signed-in appearance). /login and /setup
  // do not render companion artwork; the default id is inert there.
  useEffect(() => {
    const onAuthRoute =
      window.location.pathname === "/login" ||
      window.location.pathname === "/setup";
    if (onAuthRoute) return;
    fetchPrefs()
      .then((d) => {
        if (d?.companion) setCompanionState(d.companion);
      })
      .catch(() => {});
  }, []);

  return (
    <CompanionContext.Provider value={{ companion, setCompanion }}>
      {children}
    </CompanionContext.Provider>
  );
}

export function useCompanion() {
  return useContext(CompanionContext);
}

/**
 * Keys MUST be the backend's canonical companion slugs
 * (src/personal_world/prefs.py COMPANION EnumPref allowed set): this
 * dict is both the artwork lookup (CompanionSlot) and the choice list
 * the setup wizard submits, so a key that differs from the server
 * vocabulary silently falls back to the default artwork or fails the
 * all-or-nothing pref write.
 */
export const COMPANIONS: Record<string, { name: string; icon: string }> = {
  "personal-world": { name: "Personal World", icon: "/companions/personal-world.svg" },
  "mermaid": { name: "Mermaid", icon: "/companions/mermaid.svg" },
  "robot": { name: "Little Helper Robot", icon: "/companions/robot.svg" },
  "world-tree-squirrel": { name: "World-tree Squirrel", icon: "/companions/world-tree-squirrel.svg" },
  "taco-news-truck": { name: "Tacos & the Morning Paper", icon: "/companions/taco-news-truck.svg" },
};