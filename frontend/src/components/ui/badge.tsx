import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "healthy"
    | "warning"
    | "attention"
    | "unknown";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default:
    "border-transparent bg-[var(--pw-color-accent-primary)] text-[var(--pw-color-surface-canvas)]",
  secondary:
    "border-transparent bg-[var(--pw-color-surface-elevated)] text-[var(--pw-color-text-secondary)]",
  destructive:
    "border-transparent bg-[var(--pw-color-text-primary)] text-[var(--pw-color-surface-canvas)]",
  outline: "text-[var(--pw-color-text-primary)]",
  healthy:
    "border-transparent bg-[var(--pw-color-accent-secondary)]/15 text-[var(--pw-color-accent-secondary)]",
  warning:
    "border-transparent bg-[var(--pw-color-text-secondary)]/15 text-[var(--pw-color-text-secondary)]",
  attention:
    "border-transparent bg-[var(--pw-color-text-primary)]/15 text-[var(--pw-color-text-primary)]",
  unknown:
    "border-transparent bg-[var(--pw-color-text-muted)]/15 text-[var(--pw-color-text-muted)]",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <div className={cn(variantClasses[variant], className)} {...props} />;
}

export { Badge };