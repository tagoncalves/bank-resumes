import * as React from "react";
import { cn } from "@/lib/utils";

interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "primary" | "income" | "neutral";
}

const toneClasses = {
  primary: "data-[active=true]:bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))] data-[active=true]:text-primary",
  income: "data-[active=true]:bg-[color-mix(in_srgb,var(--color-income)_16%,var(--color-surface))] data-[active=true]:text-income",
  neutral: "data-[active=true]:bg-surface data-[active=true]:text-foreground",
};

export function FilterPill({ active = false, tone = "primary", className, ...props }: FilterPillProps) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
