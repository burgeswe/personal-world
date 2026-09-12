import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type Prefs } from "./api";

/**
 * The preference shape the context owns (the fields App applies to
 * <html>). Mirrors the server's prefs.py vocabulary.
 */
export interface PrefsState {
  motion: string;
  contrast: string;
  density: string;
  textScale: number;
  targetSize: number;
  theme: string;
}

export const PREFERENCES_DEFAULTS: PrefsState = {
  motion: "reduced",
  contrast: "comfortable",
  density: "comfortable",
  textScale: 1,
  targetSize: 44,
  theme: "dark",
};

/**
 * Apply preferences to `document.documentElement` (T9, FOUNDATION-SPEC
 * §1.2 + §10 row 10): data-pw-* attributes and --pw-* variables land on
 * <html> BEFORE the first content paint.
 *
 * Variable/attribute names mirror prefs.py (prefs_to_css_variables /
 * prefs_to_data_attributes) so the generated token layer and the
 * server-rendered style block agree:
 * - data-pw-theme (dark is the token default; light swaps the palette)
 * - data-pw-contrast (drives the focus-ring token swap)
 * - data-pw-density (+ the spacing override in index.css)
 * - data-pw-motion + --pw-motion-duration/--pw-motion-ambient per the
 *   motion tier (off/reduced → 0ms/0, subtle → 200ms/1)
 * - data-pw-text-scale + --pw-typography-text-scale-base
 * - data-pw-target-size + --pw-target-minimum (44px floor)
 *
 * Honest seam: jsdom cannot prove paint order (no rendering pipeline),
 * so "before content" is enforced structurally — the app fetches prefs
 * and applies attributes, THEN renders routes (App bootstrap), and
 * tests assert documentElement carries the attrs before/without any
 * route content mounted.
 */
/**
 * Honest OS-override check (prefs.py line 14: "The OS
 * prefers-reduced-motion setting always overrides any application
 * preference" — non-negotiable per ACCESSIBILITY_CONTRACT.md).
 *
 * jsdom does not implement `matchMedia` unless a test stubs it, so
 * this guards for that environment rather than throwing; the honest
 * fallback there is "no OS signal available", which the CSS-level
 * `@media (prefers-reduced-motion: reduce)` block in tokens.css still
 * backstops independently of this JS check.
 */
function osReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function applyPrefsToDocument(prefs: PrefsState): void {
  const root = document.documentElement;

  // The OS setting is unconditional: it wins over the stored
  // preference entirely, never just tie-breaks it. Fixed 2026-09-11
  // (UI-convergence session) — the previous version applied
  // `prefs.motion` as JS inline styles regardless of the OS query.
  // Inline styles always beat a non-`!important` stylesheet rule
  // (the tokens.css media-query block), so a person with "subtle"
  // saved as their preference kept getting `data-pw-motion="subtle"`
  // and the 200ms/ambient=1 tier even while their OS said reduce —
  // silently defeating the one safety net a migraine/cluster-headache
  // flare-up depends on. The legacy server-rendered CSS path
  // (src/personal_world/prefs.py) already got this right by relying
  // on matching CSS specificity + source order; the React port must
  // enforce it explicitly in JS since it does not use that mechanism.
  const effectiveMotion = osReducedMotion() ? "reduced" : prefs.motion;

  root.setAttribute("data-pw-theme", prefs.theme === "light" ? "light" : "dark");
  root.setAttribute(
    "data-pw-contrast",
    prefs.contrast === "high" ? "high" : "comfortable"
  );
  root.setAttribute("data-pw-density", prefs.density);
  root.setAttribute(
    "data-pw-motion",
    effectiveMotion === "off"
      ? "off"
      : effectiveMotion === "subtle"
        ? "subtle"
        : "reduced"
  );
  root.setAttribute("data-pw-text-scale", String(prefs.textScale));
  root.setAttribute("data-pw-target-size", String(Math.max(prefs.targetSize, 44)));

  // Motion tier vocabulary (prefs.py MOTION_TIERS): off and reduced both
  // run at 0ms / no ambient; subtle gets 200ms and ambient allowed.
  root.style.setProperty(
    "--pw-motion-duration",
    effectiveMotion === "subtle" ? "200ms" : "0ms"
  );
  root.style.setProperty("--pw-motion-ambient", effectiveMotion === "subtle" ? "1" : "0");

  root.style.setProperty("--pw-density", prefs.density);
  root.style.setProperty("--pw-text-scale", String(prefs.textScale));
  root.style.setProperty(
    "--pw-typography-text-scale-base",
    `${prefs.textScale}rem`
  );
  root.style.setProperty(
    "--pw-target-minimum",
    `${Math.max(prefs.targetSize, 44)}px`
  );
}

interface PrefsContextType extends PrefsState {
  setPref: (key: string, value: string | number) => void;
}

const PrefsContext = createContext<PrefsContextType>({
  ...PREFERENCES_DEFAULTS,
  setPref: () => {},
});

/**
 * T9: server prefs (`GET /api/prefs`) are the truth; the provider is
 * seeded with them at bootstrap (App applies them before routes render)
 * and re-applies to <html> on every change. `localStorage["pw_prefs"]`
 * stays deleted (§1.2: the browser holds no truth).
 */
export function PrefsProvider({
  children,
  initialPrefs = PREFERENCES_DEFAULTS,
}: {
  children: ReactNode;
  initialPrefs?: PrefsState;
}) {
  const [prefs, setPrefs] = useState<PrefsState>(initialPrefs);

  // Keep <html> in sync whenever the state changes (bootstrap and
  // Settings updates both land here).
  useEffect(() => {
    applyPrefsToDocument(prefs);
  }, [prefs]);

  // React immediately when the OS-level setting changes mid-session
  // (someone may toggle it during a flare-up and expect the app to
  // respond without touching Settings) — the unconditional-override
  // rule applies live, not just at bootstrap.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => applyPrefsToDocument(prefs);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [prefs]);

  const setPref = (key: string, value: string | number): void => {
    setPrefs((prev) => {
      const merged = { ...prev, [key]: value };
      return merged;
    });
  };

  const value = useMemo(() => ({ ...prefs, setPref }), [prefs]);

  return (
    <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
  );
}

export function usePrefs() {
  return useContext(PrefsContext);
}

/** Map the wire shape (server prefs) onto the context shape. */
export function prefsFromServer(d: Prefs | null | undefined): PrefsState {
  return {
    motion: d?.motion ?? PREFERENCES_DEFAULTS.motion,
    contrast: d?.contrast ?? PREFERENCES_DEFAULTS.contrast,
    density: d?.density ?? PREFERENCES_DEFAULTS.density,
    textScale: d?.text_scale ?? PREFERENCES_DEFAULTS.textScale,
    targetSize: d?.target_size ?? PREFERENCES_DEFAULTS.targetSize,
    theme: "dark",
  };
}

/**
 * T11 companion-off (FRONTEND-ONLY RENDERING MACHINERY — not server
 * truth):
 *
 * The backend `companion` EnumPref (prefs.py COMPANION) has no "off"
 * value; PUT /api/prefs would reject it with 400. The T8
 * CompanionSlot primitive already treats companion === "off" as
 * "remove the artwork, keep the assistant trigger" (A11y §7.4), and
 * this task owns surfacing that convention as a real control.
 *
 * Decision (owned by T11, checkpoint): "off" is a frontend display
 * value ONLY. When the person picks it, the companion context is set
 * to "off" for the session so every CompanionSlot drops its artwork
 * while the assistant trigger stays reachable. The server pref keeps
 * the last real companion id — backend prefs remain the authoritative
 * truth for the stored vocabulary, so a reload restores the last
 * server-known companion artwork.
 *
 * Honest reconciliation note: P4 (assistant drawer) or T15 (cutover)
 * must either add "off" to the server vocabulary or re-home this
 * convention; until then this mapping is deliberately NOT persisted
 * anywhere (no localStorage) — it dies with the page load by design.
 */
export const COMPANION_OFF = "off";

/**
 * The display vocabulary for the companion control: the server's
 * allowed list (the authoritative stored vocabulary) plus the
 * frontend-only "off" entry. Order matters in the UI only.
 */
export function companionChoices(serverAllowed: string[] | null | undefined): string[] {
  const base = serverAllowed && serverAllowed.length > 0 ? serverAllowed : [];
  return [COMPANION_OFF, ...base.filter((v) => v !== COMPANION_OFF)];
}
