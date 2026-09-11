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
    "border-transparent bg-[var(--color-accent-primary)] text-[var(--color-canvas)]",
  secondary:
    "border-transparent bg-[var(--color-elevated)] text-[var(--color-text-secondary)]",
  destructive:
    "border-transparent bg-[var(--color-err)] text-white",
  outline: "text-[var(--color-text-primary)]",
  healthy:
    "border-transparent bg-[var(--color-ok)]/15 text-[var(--color-ok)]",
  warning:
    "border-transparent bg-[var(--color-warn)]/15 text-[var(--color-warn)]",
  attention:
    "border-transparent bg-[var(--color-err)]/15 text-[var(--color-err)]",
  unknown:
    "border-transparent bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <div className={cn(variantClasses[variant], className)} {...props} />;
}

export { Badge };