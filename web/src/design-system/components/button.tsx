import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "ai";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const variants = {
      default: "border border-transparent bg-primary text-[var(--color-on-primary)] shadow-sm hover:bg-primary-hover",
      secondary: "border border-transparent bg-surface-alt text-foreground hover:border-border hover:bg-[var(--color-hover)]",
      outline: "border border-border bg-surface text-foreground shadow-sm hover:bg-surface-alt",
      ghost: "border border-transparent text-foreground hover:border-border hover:bg-[var(--color-hover)]",
      destructive: "border border-transparent bg-expense text-white shadow-sm hover:brightness-95",
      ai: "border border-transparent bg-ai text-white shadow-sm hover:brightness-95",
    };
    const sizes = {
      sm: "h-8 rounded-[var(--radius-md)] px-3 text-xs",
      md: "h-9 rounded-[var(--radius-md)] px-4 text-sm",
      lg: "h-11 rounded-[var(--radius-md)] px-6 text-sm",
      icon: "h-9 w-9 rounded-[var(--radius-md)]",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-[background-color,border-color,color,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
