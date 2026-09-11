import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
    fetch("/api/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.data) return;
        setPrefs((prev) => ({
          motion: d.data.motion ?? prev.motion,
          contrast: d.data.contrast ?? prev.contrast,
          density: d.data.density ?? prev.density,
          textScale: d.data.text_scale ?? prev.textScale,
          targetSize: d.data.target_size ?? prev.targetSize,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply prefs to document on change
  useEffect(() => {
    const root = document.documentElement;

    // Motion
    if (prefs.motion === "off") {
      root.style.setProperty("--motion-duration", "0ms");
      root.classList.add("motion-off");
      root.classList.remove("motion-subtle");
    } else if (prefs.motion === "subtle") {
      root.style.setProperty("--motion-duration", "150ms");
      root.classList.add("motion-subtle");
      root.classList.remove("motion-off");
    } else {
      root.style.setProperty("--motion-duration", "0ms");
      root.classList.remove("motion-off", "motion-subtle");
    }

    // Contrast
    if (prefs.contrast === "high") {
      root.classList.add("contrast-high");
      root.classList.remove("contrast-comfortable");
    } else {
      root.classList.add("contrast-comfortable");
      root.classList.remove("contrast-high");
    }

    // Density
    root.style.setProperty("--density", prefs.density);
    root.setAttribute("data-density", prefs.density);

    // Text scale
    root.style.setProperty("--text-scale-base", `${prefs.textScale}rem`);

    // Target size
    root.style.setProperty("--target-min", `${prefs.targetSize}px`);
    root.setAttribute("data-target-size", String(prefs.targetSize));
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