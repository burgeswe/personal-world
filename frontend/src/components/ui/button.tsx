import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-[var(--color-accent-primary)] text-[var(--color-canvas)] hover:bg-[var(--color-accent-primary)]/90 shadow-sm hover:shadow-md",
  destructive:
    "bg-[var(--color-err)] text-white hover:bg-[var(--color-err)]/90 shadow-sm",
  outline:
    "border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)]/50",
  secondary:
    "bg-[var(--color-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)]/80 shadow-sm",
  ghost:
    "hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)]",
  link: "text-[var(--color-accent-primary)] underline-offset-4 hover:underline",
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
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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