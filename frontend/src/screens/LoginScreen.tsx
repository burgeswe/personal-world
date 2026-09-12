import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchPrefs } from "../lib/api";
import "./login-screen.css";

/**
 * LoginScreen (P1 T12, FOUNDATION-SPEC §1.5 + §7 row 9): the
 * transitional token login. The token lives in
 * localStorage["pw_token"] (the legacy key, so existing browsers keep
 * working) until P2 replaces it with real sessions.
 *
 * Honest verification: the token is checked by fetching /api/prefs —
 * the same probe the legacy dashboard uses on load — so "Sign in"
 * means "the server accepted this token", never "a value was stored".
 * A wrong token is reported as wrong; a reachable server is never
 * confused with a successful one.
 *
 * After a verified login the app navigates to / (SPA, no reload).
 * 401s anywhere else land here through the T6 setLoginNavigation hook
 * wired in App.tsx.
 *
 * The /setup link is the recovery path when no account has been
 * configured yet (fresh install deep-link parity, row 8).
 */
function LoginScreen() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const candidate = token.trim();
    if (!candidate || busy) return;
    setBusy(true);
    setError(null);
    // Store first so the API client sends it; a 401 clears it again
    // and routes back here — that IS the failed-login state.
    localStorage.setItem("pw_token", candidate);
    try {
      await fetchPrefs();
      navigate("/", { replace: true });
    } catch {
      // 401 already cleared pw_token via the api boundary; network
      // errors leave the candidate for correction either way.
      setError("That access code did not unlock your world. Check it and try again.");
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="login-heading" className="pw-login">
      <h1 id="login-heading">Project Worlds</h1>
      <p className="pw-login-lede">Paste your access code to open your world.</p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void signIn();
        }}
      >
        <label htmlFor="pw-login-token">Access code</label>
        <input
          id="pw-login-token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="pw-login-submit" disabled={busy || !token.trim()}>
          {busy ? "Opening your world…" : "Enter"}
        </button>
        {error ? (
          <p className="pw-login-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      <p className="pw-login-alt">
        First time here? <Link to="/setup">Set up your world</Link>
      </p>
    </section>
  );
}

export default LoginScreen;