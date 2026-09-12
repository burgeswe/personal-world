import { EmptyState } from "../shell/EmptyState";

/**
 * InterestsScreen (P1 T13, FOUNDATION-SPEC §10 row T13): an honest
 * section stub. The `discovery` capability is not wired in a
 * zero-provider deployment, so this screen renders the shell
 * EmptyState naming the capability and the knob — never fabricated
 * content, never a mount path (HRC explicit state; plan C-2).
 */
export default function InterestsScreen() {
  return (
    <EmptyState
      title="Interests"
      capability="Interests collect things you care about and find more like them."
      knob="Turn on a discovery connection in Settings → Connections to populate this section."
      status="not_configured"
    />
  );
}