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

  // Sync with API on mount
  useEffect(() => {
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

export const COMPANIONS: Record<string, { name: string; icon: string }> = {
  "personal-world": { name: "Personal World", icon: "/companions/personal-world.svg" },
  "mermaid": { name: "Mermaid", icon: "/companions/mermaid.svg" },
  "robot": { name: "Little Helper Robot", icon: "/companions/robot.svg" },
  "squirrel": { name: "World-tree Squirrel", icon: "/companions/world-tree-squirrel.svg" },
  "tacos": { name: "Tacos & the Morning Paper", icon: "/companions/taco-news-truck.svg" },
};