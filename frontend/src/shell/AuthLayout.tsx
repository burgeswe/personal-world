import type { ReactNode } from "react";

/**
 * AuthLayout (P1 T14, FOUNDATION-SPEC §10 row 15 owner decision):
 * the standalone shell for /login and /setup. These routes are the
 * gate to the app — they MUST NOT render inside the authenticated
 * AppShell: no section nav, no rail/banner/bottom bar, no app
 * controls, no companion artwork. The person is not signed in yet;
 * nothing here may imply otherwise.
 *
 * Minimal on purpose: the same token layer, typography and focus
 * rules (44px targets, focus ring, motion defaults) do the styling;
 * this wrapper only owns the frame — exactly one main landmark, the
 * skip-link target. The LiveRegion stays app-level (one region for
 * the whole tree); prefs attrs are applied by the bootstrap
 * (applyPrefsToDocument) before any route renders, so the standalone
 * page already carries them.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pw-auth" data-pw-shell="auth">
      <main id="main-content" className="pw-auth-main">
        {children}
      </main>
    </div>
  );
}