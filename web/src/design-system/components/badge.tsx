import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "income" | "expense" | "saving" | "project" | "warning" | "ai";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-primary text-[var(--color-on-primary)]",
    secondary: "bg-surface-alt text-foreground",
    outline: "border border-border text-muted",
    destructive: "bg-[color-mix(in_srgb,var(--color-expense)_14%,var(--color-surface))] text-expense",
    income: "bg-[color-mix(in_srgb,var(--color-income)_14%,var(--color-surface))] text-income",
    expense: "bg-[color-mix(in_srgb,var(--color-expense)_14%,var(--color-surface))] text-expense",
    saving: "bg-[color-mix(in_srgb,var(--color-saving)_14%,var(--color-surface))] text-saving",
    project: "bg-[color-mix(in_srgb,var(--color-project)_14%,var(--color-surface))] text-project",
    warning: "bg-[color-mix(in_srgb,var(--color-warning)_16%,var(--color-surface))] text-warning",
    ai: "bg-[color-mix(in_srgb,var(--color-ai)_14%,var(--color-surface))] text-ai",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
