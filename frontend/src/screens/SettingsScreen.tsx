import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  addReminder,
  deleteReminder,
  fetchPrefs,
  fetchPrefsSchema,
  fetchReminders,
  fetchSections,
  fetchThemes,
  fetchWorldStatus,
  savePrefsPartial,
  saveSections,
  toggleReminder,
  type PrefSchemaEntry,
  type PrefsSchema,
  type Reminder,
  type SectionData,
  type ThemePackData,
  type WorldStatus,
} from "../lib/api";
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import { usePrefs, COMPANION_OFF, companionChoices } from "../lib/prefs-context";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Dialog } from "../primitives/Dialog";
import { Disclosure } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";

/**
 * Settings screen (P1 T11, FOUNDATION-SPEC §10 row T11 / parity row 6).
 *
 * Every control renders FROM server truth:
 *   - prefs from GET /api/prefs/schema (options are the server's
 *     vocabulary, never hard-coded; writes via PUT /api/prefs with the
 *     server's 400 detail surfaced VERBATIM per field);
 *   - the companion list from the schema's companion entry (prefs.py
 *     COMPANION vocabulary) plus the frontend-only "off" entry
 *     (prefs-context: rendering machinery, not server truth);
 *   - the sections panel from GET /api/sections with Move up/Move
 *     down/Hide/Show and "Restore default sections" (PUT /api/sections;
 *     settings is pinned server-side and shows NO Hide control);
 *   - reminders from GET /api/reminders (POST/PATCH/DELETE, step-up);
 *   - the capability table from GET /api/status capabilities, rendered
 *     as StatusChip words (canonical status.py vocabulary only; a null
 *     status renders the honest "unknown" word — the canonical word —
 *     with no invented status and no tint).
 *
/**
 * The shell (T9 AppShell) owns <main> and the nav — and, since the T14
 * human-gate correction, the ONE content measure (index.css .pw-main
 * --pw-content-measure); this screen renders bare inside it. All
 * targets are ≥44px via --pw-target-minimum; no hex (token vars only);
 * destructive confirms use the danger Dialog.
 */

// ── Small local styles (token vars only; no hex anywhere) ──

const panelClasses = "rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)]";
const headingClasses = "text-lg font-semibold text-[var(--pw-color-text-primary)]";
const mutedClasses = "text-[var(--pw-color-text-muted)]";

const actionButtonClasses = [
  "inline-flex min-h-[var(--pw-target-minimum)] items-center justify-center gap-2",
  "rounded-xl border border-[var(--pw-color-border-subtle)] bg-transparent",
  "px-4 text-[var(--pw-color-text-primary)]",
  "hover:border-[var(--pw-color-accent-primary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const selectClasses = [
  "min-h-[var(--pw-target-minimum)] rounded-xl border border-[var(--pw-color-border-subtle)]",
  "bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const textInputClasses = [
  "min-h-[var(--pw-target-minimum)] w-full rounded-xl border border-[var(--pw-color-border-subtle)]",
  "bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const screenButtonClasses = [
  actionButtonClasses,
  "bg-[var(--pw-color-accent-primary)] text-[var(--pw-color-surface-canvas)]",
].join(" ");

/** The preference keys this screen renders, in panel order. */
const PREF_PANEL_ORDER = [
  "motion",
  "contrast",
  "density",
  "text_scale",
  "target_size",
] as const;

/** Human labels for pref keys (labels are presentation; values are the server's). */
const PREF_LABELS: Record<string, string> = {
  motion: "Motion",
  contrast: "Contrast",
  density: "Density",
  text_scale: "Text scale",
  target_size: "Target size",
};

function formatPrefOption(value: string | number, entry: PrefSchemaEntry): string {
  if (entry.unit && typeof value === "number") {
    return `${value} ${entry.unit}`;
  }
  return String(value);
}

function isCanonicalStatus(value: unknown): value is CanonicalStatus {
  return typeof value === "string" && [
    "healthy",
    "warning",
    "unknown",
    "needs_attention",
    "unavailable",
    "stale",
    "disabled",
    "not_configured",
  ].includes(value);
}

// ── Screen ──

function SettingsScreen() {
  const { withStepUp, prompt: stepUpPrompt } = useStepUp();
  const { announce } = useAnnounce();
  const { companion, setCompanion } = useCompanion();
  const { setPref } = usePrefs();

  // ── Data (plain hooks on the typed client; each panel owns its state
  // so one failing panel degrades alone and names what still works —
  // A11y §4.5) ──
  const [schema, setSchema] = useState<PrefsSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [currentPrefs, setCurrentPrefs] = useState<Record<string, string | number> | null>(null);

  const [sections, setSections] = useState<SectionData[] | null>(null);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [sectionsBusy, setSectionsBusy] = useState(false);

  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [reminderText, setReminderText] = useState("");

  const [statusData, setStatusData] = useState<WorldStatus | null>(null);

  const [themes, setThemes] = useState<ThemePackData[] | null>(null);

  // ── Confirmation dialogs (danger = destructive, A11y §4.4) ──
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);

  const loadSections = useCallback(async (): Promise<SectionData[] | null> => {
    try {
      const payload = await fetchSections();
      setSectionsError(null);
      setSections(payload);
      return payload;
    } catch (e) {
      setSectionsError(e instanceof Error ? e.message : "Could not load sections.");
      return null;
    }
  }, []);

  const loadReminders = useCallback(async (): Promise<Reminder[] | null> => {
    try {
      const list = await fetchReminders();
      setRemindersError(null);
      setReminders(list);
      return list;
    } catch (e) {
      setRemindersError(e instanceof Error ? e.message : "Could not load reminders.");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Prefs + schema: schema drives the controls, /api/prefs drives the
    // current values (truth); prefs-context mirrors the display tier.
    fetchPrefsSchema()
      .then((s) => {
        if (!cancelled) setSchema(s);
      })
      .catch((e) => {
        if (!cancelled) setSchemaError(e instanceof Error ? e.message : "Could not load preference options.");
      });
    fetchPrefs()
      .then((d) => {
        if (!cancelled) setCurrentPrefs(d as unknown as Record<string, string | number>);
      })
      .catch(() => {
        /* defaults render until prefs load; the write path still validates */
      });
    void loadSections();
    void loadReminders();
    fetchWorldStatus()
      .then((d) => {
        if (!cancelled) setStatusData(d);
      })
      .catch(() => {
        /* capability panel renders its own honest failure */
      });
    fetchThemes()
      .then((list) => {
        if (!cancelled) setThemes(list as ThemePackData[]);
      })
      .catch(() => {
        if (!cancelled) setThemes(null); // companion list works without theme packs
      });
    return () => {
      cancelled = true;
    };
  }, [loadSections, loadReminders]);

  const companionChoicesList = useMemo(
    () => companionChoices(schema?.companion?.allowed as string[] | undefined ?? null),
    [schema]
  );

  // ── Preference write: PUT /api/prefs through step-up. The server's
  // 400 detail names the field and the reason; render it VERBATIM next
  // to the control (honest, specific — never a generic failure). ──
  const [prefErrors, setPrefErrors] = useState<Record<string, string>>({});
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const savePref = useCallback(
    async (key: string, value: string | number) => {
      // Companion choice is context machinery (prefs-context): "off"
      // never reaches the server; real vocabulary values update the
      // context and the server pref together.
      if (key === "companion") {
        if (value === COMPANION_OFF) {
          setCompanion(COMPANION_OFF);
          announce(
            "Companion artwork hidden. The World assistant is still available.",
            { kind: "action_completed", key: "companion" }
          );
          return;
        }
        setCompanion(String(value));
      } else {
        setPref(key, value);
      }
      setSavingPref(key);
      setPrefErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        await withStepUp(() => savePrefsPartial({ [key]: value }));
        announce("Settings saved.", { kind: "action_completed", key: `pref-${key}` });
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          // Server validation: show the SPECIFIC reason for THIS key.
          setPrefErrors((prev) => ({ ...prev, [key]: e.detail ?? e.message }));
        } else if (e instanceof ApiError && e.code === "step_up_required") {
          setPrefErrors((prev) => ({
            ...prev,
            [key]: "Not saved. The extra confirmation was cancelled, so nothing changed.",
          }));
        } else {
          setPrefErrors((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : "Could not save this preference." }));
        }
      } finally {
        setSavingPref(null);
      }
    },
    [announce, setCompanion, setPref, withStepUp]
  );

  // ── Sections write: PUT /api/sections through step-up, then re-read
  // the server payload (order persists via the server, not local state). ──
  const putSections = useCallback(
    async (update: { order?: string[]; hidden?: string[] }, describe: string) => {
      setSectionsBusy(true);
      try {
        await withStepUp(() => saveSections(update));
        const fresh = await loadSections();
        if (fresh) {
          announce(describe, { kind: "action_completed", key: "sections" });
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          setSectionsError(e.detail ?? e.message);
        } else {
          setSectionsError(e instanceof Error ? e.message : "Could not update sections.");
        }
        announce("Sections update failed.", { kind: "error", key: "sections" });
      } finally {
        setSectionsBusy(false);
      }
    },
    [announce, loadSections, withStepUp]
  );

  const moveSection = useCallback(
    (id: string, direction: -1 | 1) => {
      const list = sections;
      if (!list) return;
      const index = list.findIndex((s) => s.id === id);
      const swap = index + direction;
      if (index < 0 || swap < 0 || swap >= list.length) return;
      const order = list.map((s) => s.id);
      const moved = order[index];
      order[index] = order[swap];
      order[swap] = moved;
      void putSections({ order }, describeMove(list, id, direction));
    },
    [sections, putSections]
  );

  const setSectionHidden = useCallback(
    (id: string, hidden: boolean) => {
      const list = sections;
      if (!list) return;
      const currentHidden = list.filter((s) => !s.visible && !s.pinned).map((s) => s.id);
      const nextHidden = hidden
        ? [...currentHidden, id]
        : currentHidden.filter((h) => h !== id);
      const target = list.find((s) => s.id === id);
      void putSections(
        { hidden: nextHidden },
        hidden ? `${target?.label ?? id} hidden from navigation.` : `${target?.label ?? id} shown in navigation.`
      );
    },
    [sections, putSections]
  );

  const restoreDefaultSections = useCallback(() => {
    setResetConfirm(false);
    void putSections(
      { order: [], hidden: [] },
      "Sections restored to defaults."
    );
  }, [putSections]);

  // ── Reminder writes: step-up + live announcements ──
  const addReminderNow = useCallback(async () => {
    const text = reminderText.trim();
    if (!text) return;
    try {
      await withStepUp(() => addReminder(text));
      setReminderText("");
      await loadReminders();
      announce(`Reminder added: ${text}`, { kind: "action_completed", key: "reminder-add" });
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail ?? e.message : "Could not add the reminder.";
      setRemindersError(detail);
      announce(`Reminder failed: ${detail}`, { kind: "error", key: "reminder-add" });
    }
  }, [announce, loadReminders, reminderText, withStepUp]);

  const toggleReminderNow = useCallback(
    async (r: Reminder) => {
      try {
        await withStepUp(() => toggleReminder(r.id, !r.enabled));
        await loadReminders();
        announce(
          `Reminder "${r.text}" ${!r.enabled ? "enabled" : "paused"}.`,
          { kind: "action_completed", key: `reminder-${r.id}` }
        );
      } catch (e) {
        setRemindersError(e instanceof ApiError ? e.detail ?? e.message : "Could not update the reminder.");
      }
    },
    [announce, loadReminders, withStepUp]
  );

  const deleteReminderNow = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await withStepUp(() => deleteReminder(target.id));
      await loadReminders();
      announce(`Reminder deleted: ${target.text}`, { kind: "action_completed", key: `reminder-${target.id}` });
    } catch (e) {
      setRemindersError(e instanceof ApiError ? e.detail ?? e.message : "Could not delete the reminder.");
    }
  }, [announce, deleteTarget, loadReminders, withStepUp]);

  const capabilities = useMemo(() => {
    const caps = statusData?.capabilities ?? {};
    return Object.entries(caps).sort(([a], [b]) => a.localeCompare(b));
  }, [statusData]);

  const prefPanels = PREF_PANEL_ORDER.filter((key) => schema ? schema[key] !== undefined : false);
  const hasSections = sections !== null;
  const settingsPinnedNote = "Settings is always reachable — it cannot be hidden.";

  return (
    <div className="space-y-6">
      <h1 className={`${headingClasses} text-3xl font-bold`} style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
        Settings
      </h1>

      {/* ── Preferences (from GET /api/prefs/schema) ── */}
      <section aria-labelledby="prefs-heading" data-testid="prefs-panel">
        <h2 id="prefs-heading" className={headingClasses}>Reading &amp; interaction</h2>
        <p className={`mt-1 text-sm ${mutedClasses}`}>
          These preferences apply everywhere. Options come from your server's preference vocabulary.
        </p>
        {schemaError !== null && (
          <p role="alert" className="mt-2 text-sm text-[var(--pw-color-text-primary)]">
            Preference options are unavailable: {schemaError} Your current settings still apply.
          </p>
        )}
        <div className={`mt-3 ${panelClasses} divide-y divide-[var(--pw-color-border-subtle)]`}>
          {schema === null && schemaError === null && (
            <p className="p-4 text-sm text-[var(--pw-color-text-muted)]">Loading preference options…</p>
          )}
          {prefPanels.map((key) => {
            const entry = schema?.[key];
            if (!entry) return null;
            const options = entry.allowed ?? [];
            const value = (currentPrefs?.[key] ?? entry.default) as string | number;
            const error = prefErrors[key];
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <label htmlFor={`pref-${key}`} className="text-sm text-[var(--pw-color-text-primary)]">
                  {PREF_LABELS[key] ?? key}
                </label>
                <span className="flex flex-col items-end gap-1">
                  <select
                    id={`pref-${key}`}
                    className={selectClasses}
                    value={String(value)}
                    disabled={savingPref === key}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const parsed = entry.type === "number" ? Number(raw) : raw;
                      void savePref(key, parsed);
                    }}
                  >
                    {options.map((opt) => (
                      <option key={String(opt)} value={String(opt)}>
                        {formatPrefOption(opt, entry)}
                      </option>
                    ))}
                  </select>
                  {error && (
                    <span role="alert" data-testid={`pref-error-${key}`} className="max-w-md text-right text-xs text-[var(--pw-color-text-primary)]">
                      {`Not saved: ${error}`}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Companion (schema vocabulary + frontend-only off) ── */}
      <section aria-labelledby="companion-heading" data-testid="companion-panel">
        <h2 id="companion-heading" className={headingClasses}>Companion</h2>
        <p className={`mt-1 text-sm ${mutedClasses}`}>
          Turning the companion off hides its artwork everywhere. The World assistant stays reachable.
        </p>
        <div className={`mt-3 ${panelClasses} divide-y divide-[var(--pw-color-border-subtle)]`}>
          {companionChoicesList.map((choice) => {
            const isActive = companion === choice;
            const name = choice === COMPANION_OFF ? "Off (artwork hidden)" : humanCompanion(choice);
            return (
              <div key={choice} className="flex items-center justify-between gap-3 p-4">
                <span className="text-sm text-[var(--pw-color-text-primary)]">{name}</span>
                <button
                  type="button"
                  className={actionButtonClasses}
                  aria-pressed={isActive}
                  aria-label={isActive ? `${name}, selected` : `Select ${name}`}
                  onClick={() => void savePref("companion", choice)}
                >
                  {isActive ? "Selected" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Sections panel (the core deliverable, GET/PUT /api/sections) ── */}
      <section aria-labelledby="sections-heading" data-testid="sections-panel">
        <h2 id="sections-heading" className={headingClasses}>Sections</h2>
        <p className={`mt-1 text-sm ${mutedClasses}`}>
          Reorder with the move buttons, hide what you do not use, or restore the defaults.
        </p>
        {sectionsError !== null && (
          <p role="alert" data-testid="sections-error" className="mt-2 text-sm text-[var(--pw-color-text-primary)]">
            Sections update failed: {sectionsError} Nothing was changed.
          </p>
        )}
        {sections === null && sectionsError === null && (
          <p className={`mt-2 p-4 text-sm ${mutedClasses}`}>Loading sections…</p>
        )}
        {hasSections && (
          <ul className="mt-3 space-y-2" data-testid="sections-list">
            {sections.map((s, index) => (
              <li
                key={s.id}
                data-testid={`section-row-${s.id}`}
                className={`${panelClasses} flex flex-wrap items-center justify-between gap-2 p-3`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-sm text-[var(--pw-color-text-primary)]">{s.label}</span>
                  {s.status !== null && isCanonicalStatus(s.status) ? (
                    <StatusChip status={s.status} size="sm" />
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className={actionButtonClasses}
                    disabled={index === 0 || sectionsBusy}
                    aria-label={`Move ${s.label} up`}
                    onClick={() => moveSection(s.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={actionButtonClasses}
                    disabled={index === sections.length - 1 || sectionsBusy}
                    aria-label={`Move ${s.label} down`}
                    onClick={() => moveSection(s.id, 1)}
                  >
                    ↓
                  </button>
                  {s.visible ? (
                    s.pinned ? null : (
                      <button
                        type="button"
                        className={actionButtonClasses}
                        disabled={sectionsBusy}
                        aria-label={`Hide ${s.label}`}
                        data-testid={`hide-${s.id}`}
                        onClick={() => setSectionHidden(s.id, true)}
                      >
                        Hide
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className={actionButtonClasses}
                      disabled={sectionsBusy}
                      aria-label={`Show ${s.label}`}
                      data-testid={`show-${s.id}`}
                      onClick={() => setSectionHidden(s.id, false)}
                    >
                      Show
                    </button>
                  )}
                  {s.pinned && <span className="text-xs text-[var(--pw-color-text-muted)]">{settingsPinnedNote}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <button
            type="button"
            className={actionButtonClasses}
            data-testid="restore-sections"
            disabled={sectionsBusy}
            onClick={() => setResetConfirm(true)}
          >
            Restore default sections
          </button>
        </div>
      </section>

      {/* ── Companion theme packs (GET /api/themes; legacy parity) ──
          Selecting a pack sets the companion pref to the pack name —
          offered only when the name is in the server's companion
          vocabulary, so Settings never offers a value the server
          would 400. ── */}
      {themes !== null && themes.length > 0 && (
        <section aria-labelledby="themes-heading" data-testid="themes-panel">
          <h2 id="themes-heading" className={headingClasses}>Companion themes</h2>
          <div className={`mt-3 ${panelClasses} divide-y divide-[var(--pw-color-border-subtle)]`}>
            {themes.map((pack) => {
              const offered = companionChoicesList.includes(pack.name);
              return (
                <div key={pack.name} className="flex items-center justify-between gap-3 p-4">
                  <span className="text-sm text-[var(--pw-color-text-primary)]">
                    {pack.display_name || pack.name}
                  </span>
                  {offered ? (
                    <button
                      type="button"
                      className={actionButtonClasses}
                      aria-pressed={companion === pack.name}
                      aria-label={companion === pack.name ? `${pack.display_name || pack.name}, selected` : `Select ${pack.display_name || pack.name}`}
                      onClick={() => void savePref("companion", pack.name)}
                    >
                      {companion === pack.name ? "Selected" : "Select"}
                    </button>
                  ) : (
                    <span className={`text-xs ${mutedClasses}`}>Not a companion option on this server.</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Reminders ── */}
      <section aria-labelledby="reminders-heading" data-testid="reminders-panel">
        <h2 id="reminders-heading" className={headingClasses}>Reminders</h2>
        {remindersError !== null && (
          <p role="alert" className="mt-2 text-sm text-[var(--pw-color-text-primary)]">
            Reminders problem: {remindersError}
          </p>
        )}
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addReminderNow();
          }}
        >
          <label htmlFor="reminder-text" className="sr-only">New reminder text</label>
          <input
            id="reminder-text"
            className={`${textInputClasses} max-w-sm`}
            value={reminderText}
            placeholder="New reminder text"
            onChange={(e) => setReminderText(e.target.value)}
          />
          <button type="submit" className={screenButtonClasses} disabled={reminderText.trim() === ""}>
            Add reminder
          </button>
        </form>
        <ul className="mt-3 space-y-2" data-testid="reminders-list">
          {Array.isArray(reminders) && reminders.length === 0 && (
            <li className={`p-3 text-sm ${mutedClasses}`}>No reminders yet.</li>
          )}
          {Array.isArray(reminders) &&
            reminders.map((r) => (
              <li key={r.id} className={`${panelClasses} flex flex-wrap items-center justify-between gap-2 p-3`}>
                <span className="text-sm text-[var(--pw-color-text-primary)]">{r.text}</span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className={actionButtonClasses}
                    aria-pressed={r.enabled}
                    aria-label={r.enabled ? `Pause reminder ${r.text}` : `Resume reminder ${r.text}`}
                    onClick={() => void toggleReminderNow(r)}
                  >
                    {r.enabled ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    className={actionButtonClasses}
                    aria-label={`Delete reminder ${r.text}`}
                    data-testid={`delete-reminder-${r.id}`}
                    onClick={() => setDeleteTarget(r)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
        </ul>
      </section>

      {/* ── Capability table (GET /api/status) ── */}
      <section aria-labelledby="capabilities-heading" data-testid="capabilities-panel">
        <h2 id="capabilities-heading" className={headingClasses}>Capabilities</h2>
        {statusData === null ? (
          <p className={`mt-2 text-sm ${mutedClasses}`}>
            Capability status is unavailable right now. Everything else on this screen still works.
          </p>
        ) : (
          <Disclosure summary="Capability details" level={2} defaultOpen>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Capability status and warnings</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-2 pr-4">Capability</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map(([name, cap]) => (
                  <tr key={name} className="border-t border-[var(--pw-color-border-subtle)]">
                    <th scope="row" className="py-2 pr-4 font-normal">{humanizeName(name)}</th>
                    <td className="py-2 pr-4">
                      <StatusChip status={isCanonicalStatus(cap.status) ? cap.status : "unknown"} />
                    </td>
                    <td className="py-2 text-[var(--pw-color-text-secondary)]">
                      {cap.warnings && cap.warnings.length > 0 ? cap.warnings.join("; ") : "—"}
                    </td>
                  </tr>
                ))}
                {capabilities.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-2 text-[var(--pw-color-text-muted)]">
                      No capabilities are defined.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Disclosure>
        )}
      </section>

      {/* ── Dialogs ── */}
      <Dialog
        open={resetConfirm}
        title="Restore default sections?"
        description="This sends the server's reset command: your section order and hidden sections return to the defaults. The defaults always keep Settings reachable."
        confirmLabel="Restore defaults"
        danger
        onCancel={() => setResetConfirm(false)}
        onConfirm={restoreDefaultSections}
      />
      <Dialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete reminder "${deleteTarget.text}"?` : "Delete reminder?"}
        description="This removes the reminder from your reminder list. It cannot be undone from this screen."
        confirmLabel="Delete reminder"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteReminderNow()}
      />
      {stepUpPrompt}
    </div>
  );
}

function describeMove(list: SectionData[], id: string, direction: -1 | 1): string {
  const label = list.find((s) => s.id === id)?.label ?? id;
  const at = list.findIndex((s) => s.id === id);
  if (direction === -1 && at === 1) return `${label} moved to the top.`;
  if (direction === 1 && at === list.length - 2) return `${label} moved to the bottom.`;
  return `${label} moved ${direction === -1 ? "up" : "down"}.`;
}

/** Legacy companion display names (parity with the old Settings list). */
function humanCompanion(id: string): string {
  const known = COMPANIONS[id];
  if (known) return known.name;
  switch (id) {
    case "world-tree-squirrel":
      return "World-tree Squirrel";
    case "taco-news-truck":
      return "Tacos & the Morning Paper";
    default:
      return id;
  }
}

function humanizeName(name: string): string {
  return name.replace(/_/g, " ");
}

export default SettingsScreen;