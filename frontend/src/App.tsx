import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import TodayScreen from "./screens/TodayScreen";
import ChatRoute from "./screens/ChatRoute";
import LoginScreen from "./screens/LoginScreen";
import JournalScreen from "./screens/JournalScreen";
import VaultScreen from "./screens/VaultScreen";
import WorldScreen from "./screens/WorldScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SetupWizard from "./screens/SetupWizard";
import InterestsScreen from "./screens/InterestsScreen";
import MediaScreen from "./screens/MediaScreen";
import ProjectsScreen from "./screens/ProjectsScreen";
import LabScreen from "./screens/LabScreen";
import { CompanionProvider } from "./lib/companion-context";
import {
  PrefsProvider,
  applyPrefsToDocument,
  prefsFromServer,
  PREFERENCES_DEFAULTS,
} from "./lib/prefs-context";
import { LiveRegionProvider } from "./primitives/LiveRegion";
import { fetchPrefs, setLoginNavigation } from "./lib/api";
import { AppShell } from "./shell/AppShell";
import { AuthLayout } from "./shell/AuthLayout";

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
  const location = useLocation();
  // T14: on /login and /setup the ShellGate keeps this subtree
  // unmounted, so this effect never runs there — no unauthenticated
  // /api/prefs fetch, no 401 noise on the auth pages (the AuthRoutes
  // frame renders without prefs-dependent content; attrs come from
  // the PrefsProvider defaults already applied at the document root).
  const isAuthRoute =
    location.pathname === "/login" || location.pathname === "/setup";

  useEffect(() => {
    if (isAuthRoute) {
      setBooted(true);
      return;
    }
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
      <Route path="/" element={<TodayScreen />} />
      <Route path="/interests" element={<InterestsScreen />} />
      <Route path="/media" element={<MediaScreen />} />
      <Route path="/projects" element={<ProjectsScreen />} />
      <Route path="/lab" element={<LabScreen />} />
      <Route path="/chat" element={<ChatRoute />} />
      <Route path="/journal" element={<JournalScreen />} />
      <Route path="/vault" element={<VaultScreen />} />
      <Route path="/world" element={<WorldScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  );
}

/**
 * Standalone auth routes (T14 owner decision): /login and /setup
 * render in the AuthLayout wrapper, OUTSIDE the AppShell — no section
 * nav, no rail/banner/bottom bar, no app controls. A person who is
 * not signed in never sees (half of) the app. Same bootstrap pattern
 * as AppRoutes: prefs land on <html data-pw-*> before any route
 * content appears.
 */
function AuthRoutes() {
  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <AuthLayout>
            <SetupWizard />
          </AuthLayout>
        }
      />
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginScreen />
          </AuthLayout>
        }
      />
    </Routes>
  );
}

/**
 * ShellGate (T14 owner decision): the authenticated AppShell mounts
 * ONLY on non-auth routes. On /login and /setup it renders nothing
 * at all — the standalone AuthLayout owns the page. This is a
 * structural absence, not a CSS hide: a display:none shell would
 * still boot its data hooks and fire unauthenticated /api requests
 * (401 console noise, half-signed-in appearance).
 */
function ShellGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthRoute =
    location.pathname === "/login" || location.pathname === "/setup";
  if (isAuthRoute) return null;
  return <>{children}</>;
}

/**
 * Login navigation (T12, FOUNDATION-SPEC §1.5): the T6 api boundary
 * owns the 401→/login contract; this wires its settable hook to the
 * router (SPA navigation instead of a hard reload). Lives inside the
 * BrowserRouter so useNavigate resolves. Any 401 from any screen
 * routes here; the token was already cleared by the api boundary.
 */
function LoginNavigationWiring() {
  const navigate = useNavigate();
  useEffect(() => {
    setLoginNavigation((path) => navigate(path, { replace: true }));
    return () =>
      setLoginNavigation((path) => window.location.assign(path));
  }, [navigate]);
  return null;
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
              LoginNavigationWiring (T12): SPA 401→/login for the whole
              tree, no chat/auth logic in routes.
            */}
            <LoginNavigationWiring />
            {/* Standalone auth routes (T14): /login + /setup never
                mount inside the authenticated AppShell — and the
                AppShell never mounts on them (no nav, no 401-fetch
                storm from a hidden shell: the shell is ABSENT, not
                display:none'd — see ShellGate). */}
            <ShellGate>
              <AppShell>
                <AppRoutes />
              </AppShell>
            </ShellGate>
            <AuthRoutes />
          </BrowserRouter>
        </LiveRegionProvider>
      </PrefsProvider>
    </CompanionProvider>
  );
}

export default App;