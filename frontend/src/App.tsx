import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TodayScreen from "./screens/TodayScreen";
import ChatScreen from "./screens/ChatScreen";
import JournalScreen from "./screens/JournalScreen";
import WorldScreen from "./screens/WorldScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SetupWizard from "./screens/SetupWizard";
import { CompanionProvider } from "./lib/companion-context";
import {
  PrefsProvider,
  applyPrefsToDocument,
  prefsFromServer,
  PREFERENCES_DEFAULTS,
} from "./lib/prefs-context";
import { LiveRegionProvider } from "./primitives/LiveRegion";
import { fetchPrefs } from "./lib/api";
import { AppShell } from "./shell/AppShell";
import { EmptyState } from "./shell/EmptyState";

/**
 * Bootstrap (T9, FOUNDATION-SPEC §1.2 + §10 row 10): preferences are
 * fetched and applied to <html data-pw-*> BEFORE any route renders, so
 * the first content paint already carries the person's motion, contrast,
 * density, text scale, target size, and theme. The routes render only
 * after that is done — that ordering is the structural guarantee (jsdom
 * cannot prove paint order; the guarantee is "no route content exists
 * before the attrs land on documentElement").
 */
function AppRoutes() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPrefs()
      .then((d) => {
        applyPrefsToDocument(prefsFromServer(d));
      })
      .catch(() => {
        // Server unreachable or not signed in: the accessible defaults
        // are already the token defaults; apply them explicitly so the
        // attrs exist either way.
        applyPrefsToDocument(PREFERENCES_DEFAULTS);
      })
      .finally(() => {
        if (!cancelled) setBooted(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!booted) return null;

  return (
    <Routes>
      <Route path="/setup" element={<SetupWizard />} />
      <Route path="/" element={<TodayScreen />} />
      <Route path="/interests" element={<InterestsRoute />} />
      <Route path="/media" element={<MediaRoute />} />
      <Route path="/projects" element={<ProjectsRoute />} />
      <Route path="/lab" element={<LabRoute />} />
      <Route path="/chat" element={<ChatScreen />} />
      <Route path="/journal" element={<JournalScreen />} />
      <Route path="/world" element={<WorldScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  );
}

/**
 * Route wrappers (T9): the four stub sections render honest
 * EmptyStates naming the capability and the knob (T13 replaces these;
 * Lab's real table comes with T13 too). The shell owns
 * `<main id="main-content">` (AppShell), so routes render bare inside
 * it — the prototype screens keep their markup but no longer declare
 * the main landmark (T10–T12 redesigns them). Hidden sections are
 * omitted from the nav but their routes still resolve (§5/§10).
 */
function InterestsRoute() {
  return (
    <EmptyState
      title="Interests"
      capability="Interests collect things you care about and find more like them."
      knob="Turn on a discovery connection in Settings → Connections to populate this section."
      status="not_configured"
    />
  );
}

function MediaRoute() {
  return (
    <EmptyState
      title="Media"
      capability="Media gathers your stories, bookmarks, and saved reading."
      knob="Add a media connection in Settings → Connections to enable this section."
      status="not_configured"
    />
  );
}

function ProjectsRoute() {
  return (
    <EmptyState
      title="Projects"
      capability="Projects follow your repositories and their recent activity."
      knob="List repository locations under Source Control in Settings to enable this section."
    />
  );
}

function LabRoute() {
  return (
    <EmptyState
      title="Lab"
      capability="Lab watches the health of your homelab services."
      knob="Set the lab command-line path in your server settings to enable this section."
      status="not_configured"
    />
  );
}

function App() {
  return (
    <CompanionProvider>
      <PrefsProvider>
        <LiveRegionProvider>
          <BrowserRouter basename="/">
            {/*
              AppShell (T9): skip link, nav "Main", main#main-content,
              Drawer mount. LiveRegionProvider stays app-level (one
              region). The router wraps the shell so NavLinks resolve.
            */}
            <AppShell>
              <AppRoutes />
            </AppShell>
          </BrowserRouter>
        </LiveRegionProvider>
      </PrefsProvider>
    </CompanionProvider>
  );
}

export default App;