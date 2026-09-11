import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchPrefs } from "./api";

interface PrefsContextType {
  motion: string;
  contrast: string;
  density: string;
  textScale: number;
  targetSize: number;
  setPref: (key: string, value: string | number) => void;
}

const PrefsContext = createContext<PrefsContextType>({
  motion: "reduced",
  contrast: "comfortable",
  density: "comfortable",
  textScale: 1,
  targetSize: 44,
  setPref: () => {},
});

/**
 * T4: transitional prefs context. Server prefs (`GET /api/prefs`) are the
 * truth; `localStorage["pw_prefs"]` is no longer read or written
 * (deleted per FOUNDATION-SPEC §1.2). T9/T11 move this behind the typed
 * API client and `data-pw-*` attributes per §1.2 and the parity plan.
 */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState({
    motion: "reduced",
    contrast: "comfortable",
    density: "comfortable",
    textScale: 1,
    targetSize: 44,
  });

  // Sync from the server once on mount; localStorage is not consulted.
  useEffect(() => {
    let cancelled = false;
    fetchPrefs()
      .then((d) => {
        if (cancelled || !d) return;
        setPrefs((prev) => ({
          motion: d.motion ?? prev.motion,
          contrast: d.contrast ?? prev.contrast,
          density: d.density ?? prev.density,
          textScale: d.text_scale ?? prev.textScale,
          targetSize: d.target_size ?? prev.targetSize,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply prefs to document on change. Variable names mirror the
  // server's prefs_to_css_variables() (prefs.py) so the generated token
  // layer and the server-rendered style block agree.
  useEffect(() => {
    const root = document.documentElement;

    // Motion: tier comes from the server vocabulary (off | reduced |
    // subtle). off and reduced both run at 0ms; subtle gets 200ms.
    root.setAttribute(
      "data-pw-motion",
      prefs.motion === "off"
        ? "off"
        : prefs.motion === "subtle"
          ? "subtle"
          : "reduced"
    );
    root.style.setProperty(
      "--pw-motion-duration",
      prefs.motion === "subtle" ? "200ms" : "0ms"
    );
    root.style.setProperty(
      "--pw-motion-ambient",
      prefs.motion === "subtle" ? "1" : "0"
    );

    // Contrast (drives the focus-ring token swap in index.css)
    root.setAttribute(
      "data-pw-contrast",
      prefs.contrast === "high" ? "high" : "comfortable"
    );

    // Density
    root.style.setProperty("--pw-density", prefs.density);
    root.setAttribute("data-pw-density", prefs.density);

    // Text scale
    root.style.setProperty(
      "--pw-text-scale",
      String(prefs.textScale)
    );
    root.style.setProperty(
      "--pw-typography-text-scale-base",
      `${prefs.textScale}rem`
    );

    // Target size (44px floor is enforced server-side too)
    root.style.setProperty(
      "--pw-target-minimum",
      `${Math.max(prefs.targetSize, 44)}px`
    );
    root.setAttribute("data-pw-target-size", String(prefs.targetSize));
  }, [prefs]);

  const setPref = (key: string, value: string | number) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <PrefsContext.Provider value={{ ...prefs, setPref }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  return useContext(PrefsContext);
}