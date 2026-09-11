import { EmptyState } from "../shell/EmptyState";

/**
 * ProjectsScreen (P1 T13, FOUNDATION-SPEC §10 row T13): an honest
 * section stub. The `source_control` native baseline needs repo search
 * paths (the `source_control.search_paths` setting in the connections
 * config); until any are configured this section renders the shell
 * EmptyState naming the capability and the knob — never a mount path.
 */
export default function ProjectsScreen() {
  return (
    <EmptyState
      title="Projects"
      capability="Projects follow your repositories and their recent activity."
      knob="List repository locations under Source Control in Settings to enable this section."
    />
  );
}