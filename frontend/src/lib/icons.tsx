/**
 * Local icon shim for the transitional screens (T4 keeps behavior, P1
 * screen tasks T10–T13 replace these screens wholesale). The old icon
 * dependency is dieted out per FOUNDATION-SPEC §1.4; the icon system is
 * the tracked sprite. Each shimmed name maps to a sprite symbol id that
 * exists in src/personal_world/static/icons/sprite.svg and is asserted
 * by src/test/icons.spec.ts; T5/T9 re-audit icon ids against
 * design/assets/icons/manifest.json.
 */
import type { SVGProps } from "react";

const ICON_NAMES = [
  "icon-actions-add",
  "icon-actions-delete",
  "icon-actions-edit",
  "icon-actions-filter",
  "icon-actions-more",
  "icon-actions-refresh",
  "icon-actions-search",
  "icon-actions-upload",
  "icon-chat-ai-send",
  "icon-chat-ai-stop",
  "icon-chat-ai-agent",
  "icon-chat-ai-ideas",
  "icon-chat-ai-context",
  "icon-chat-ai-tools",
  "icon-chat-ai-voice",
  "icon-chat-ai-actions",
  "icon-chat-ai-attach",
  "icon-chat-ai-code",
  "icon-chat-ai-sources",
  "icon-navigation-chat",
  "icon-navigation-journal",
  "icon-navigation-projects",
  "icon-navigation-settings",
  "icon-navigation-today",
  "icon-navigation-worlds",
  "icon-people-community-heart",
  "icon-people-community-person",
  "icon-people-community-people",
  "icon-people-community-message",
  "icon-people-community-community",
  "icon-people-community-mention",
  "icon-status-feedback-error",
  "icon-status-feedback-loading",
  "icon-status-feedback-success",
  "icon-status-feedback-warning",
  "icon-status-feedback-notification",
  "icon-status-feedback-offline",
  "icon-status-feedback-info",
  "icon-system-device-desktop",
  "icon-system-device-lock",
  "icon-system-device-theme",
  "icon-system-device-accessibility",
  "icon-system-device-keyboard",
  "icon-system-device-mobile",
  "icon-time-organization-archive",
  "icon-time-organization-calendar",
  "icon-time-organization-clock",
  "icon-time-organization-history",
  "icon-time-organization-pin",
  "icon-time-organization-sort",
  "icon-view-layout-collapse",
  "icon-view-layout-expand",
  "icon-view-layout-grid",
  "icon-view-layout-list",
  "icon-view-layout-sidebar",
  "icon-view-layout-columns",
  "icon-view-layout-zoom-in",
  "icon-view-layout-zoom-out",
  "icon-world-content-bookmark",
  "icon-world-content-link",
  "icon-world-content-lore",
  "icon-world-content-memory",
  "icon-world-content-story",
  "icon-world-content-tag",
  "icon-world-content-world",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
export { ICON_NAMES };

/**
 * Section icon ids arrive from GET /api/sections in the sprite's
 * `<category>--<name>` form (e.g. "navigation--today"); the shim's
 * ICON_NAMES use the legacy dash form ("icon-navigation-today").
 * This maps one to the other; ids absent from both spellings render
 * label-only (SectionNav) rather than guessing a broken glyph.
 */
export function sectionIconToShimName(spriteId: string): IconName | null {
  const shimName = `icon-${spriteId.replace("--", "-")}` as IconName;
  return (ICON_NAMES as readonly string[]).includes(shimName)
    ? shimName
    : null;
}

// "name" is omitted from SVG props so the sprite symbol id stays a
// closed literal union (SVGAttributes.name is a plain string).
export type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  size?: number;
};

export function Icon({
  name,
  size = 24,
  className,
  ...rest
}: IconProps & { name: IconName }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={rest["aria-hidden"] ?? true}
      focusable="false"
    >
      <use href={`/icons/sprite.svg#${name}`} />
    </svg>
  );
}

export const Loader2 = (props: IconProps) => (
  <Icon name="icon-status-feedback-loading" {...props} />
);
export const AlertCircle = (props: IconProps) => (
  <Icon name="icon-status-feedback-error" {...props} />
);
export const Inbox = (props: IconProps) => (
  <Icon name="icon-time-organization-archive" {...props} />
);
export const CheckCircle2 = (props: IconProps) => (
  <Icon name="icon-status-feedback-success" {...props} />
);
export const Clock = (props: IconProps) => (
  <Icon name="icon-time-organization-clock" {...props} />
);
export const Globe = (props: IconProps) => (
  <Icon name="icon-world-content-world" {...props} />
);
export const Shield = (props: IconProps) => (
  <Icon name="icon-system-device-lock" {...props} />
);
export const Zap = (props: IconProps) => (
  <Icon name="icon-chat-ai-agent" {...props} />
);
export const Bell = (props: IconProps) => (
  <Icon name="icon-status-feedback-notification" {...props} />
);
export const BookOpen = (props: IconProps) => (
  <Icon name="icon-world-content-story" {...props} />
);
export const Sparkles = (props: IconProps) => (
  <Icon name="icon-chat-ai-ideas" {...props} />
);
export const FileText = (props: IconProps) => (
  <Icon name="icon-world-content-lore" {...props} />
);
export const Settings = (props: IconProps) => (
  <Icon name="icon-system-device-theme" {...props} />
);
export const GitCommit = (props: IconProps) => (
  <Icon name="icon-actions-edit" {...props} />
);
export const GitBranch = (props: IconProps) => (
  <Icon name="icon-world-content-link" {...props} />
);
export const Heart = (props: IconProps) => (
  <Icon name="icon-people-community-heart" {...props} />
);
export const Send = (props: IconProps) => (
  <Icon name="icon-chat-ai-send" {...props} />
);
export const User = (props: IconProps) => (
  <Icon name="icon-people-community-person" {...props} />
);
export const Users = (props: IconProps) => (
  <Icon name="icon-people-community-people" {...props} />
);
export const Calendar = (props: IconProps) => (
  <Icon name="icon-time-organization-calendar" {...props} />
);
export const Cloud = (props: IconProps) => (
  <Icon name="icon-world-content-world" {...props} />
);
export const Mail = (props: IconProps) => (
  <Icon name="icon-people-community-message" {...props} />
);
export const X = (props: IconProps) => (
  <Icon name="icon-actions-delete" {...props} />
);
export const Search = (props: IconProps) => (
  <Icon name="icon-actions-search" {...props} />
);
export const Filter = (props: IconProps) => (
  <Icon name="icon-actions-filter" {...props} />
);
export const Plus = (props: IconProps) => (
  <Icon name="icon-actions-add" {...props} />
);
export const ChevronLeft = (props: IconProps) => (
  <Icon name="icon-view-layout-collapse" {...props} />
);
export const ChevronRight = (props: IconProps) => (
  <Icon name="icon-view-layout-expand" {...props} />
);
export const ChevronDown = (props: IconProps) => (
  <Icon name="icon-view-layout-collapse" {...props} />
);
export const Eye = (props: IconProps) => (
  <Icon name="icon-system-device-accessibility" {...props} />
);
export const Monitor = (props: IconProps) => (
  <Icon name="icon-system-device-desktop" {...props} />
);
export const Palette = (props: IconProps) => (
  <Icon name="icon-system-device-theme" {...props} />
);
export const Hand = (props: IconProps) => (
  <Icon name="icon-system-device-accessibility" {...props} />
);
export const Key = (props: IconProps) => (
  <Icon name="icon-system-device-lock" {...props} />
);
export const Link = (props: IconProps) => (
  <Icon name="icon-world-content-link" {...props} />
);
export const Check = (props: IconProps) => (
  <Icon name="icon-status-feedback-success" {...props} />
);
export const Wrench = (props: IconProps) => (
  <Icon name="icon-actions-edit" {...props} />
);