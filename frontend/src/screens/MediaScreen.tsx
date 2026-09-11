import { EmptyState } from "../shell/EmptyState";

/**
 * MediaScreen (P1 T13, FOUNDATION-SPEC §10 row T13): an honest section
 * stub. The `media` capability has no provider in a zero-provider
 * deployment, so this screen renders the shell EmptyState naming the
 * capability and the knob — no demo lists, no mount paths.
 */
export default function MediaScreen() {
  return (
    <EmptyState
      title="Media"
      capability="Media gathers your stories, bookmarks, and saved reading."
      knob="Add a media connection in Settings → Connections to enable this section."
      status="not_configured"
    />
  );
}