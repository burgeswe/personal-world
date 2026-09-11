import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-[var(--pw-color-accent-primary)] text-[var(--pw-color-surface-canvas)] hover:bg-[var(--pw-color-accent-primary)]/90 shadow-sm hover:shadow-md",
  destructive:
    "bg-[var(--pw-color-text-primary)] text-[var(--pw-color-surface-canvas)] hover:bg-[var(--pw-color-text-secondary)] shadow-sm",
  outline:
    "border border-[var(--pw-color-border-subtle)] bg-transparent hover:bg-[var(--pw-color-surface-elevated)] hover:text-[var(--pw-color-text-primary)] hover:border-[var(--pw-color-accent-primary)]/50",
  secondary:
    "bg-[var(--pw-color-surface-elevated)] text-[var(--pw-color-text-primary)] hover:bg-[var(--pw-color-surface-elevated)]/80 shadow-sm",
  ghost:
    "hover:bg-[var(--pw-color-surface-elevated)] hover:text-[var(--pw-color-text-primary)]",
  link: "text-[var(--pw-color-accent-primary)] underline-offset-4 hover:underline",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-11 px-5 py-2.5",
  sm: "h-9 rounded-lg px-3",
  lg: "h-12 rounded-xl px-8",
  icon: "h-11 w-11",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-color-accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pw-color-surface-canvas)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };