import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatePanelVariant = "default" | "generating" | "error" | "empty" | "success";

interface StatePanelProps {
  variant?: StatePanelVariant;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const variantStyles: Record<StatePanelVariant, string> = {
  default: "border-border bg-card/80",
  generating: "border-primary/25 bg-card/90",
  error: "border-destructive/35 bg-destructive/[0.03]",
  empty: "border-dashed border-border bg-transparent",
  success: "border-primary/20 bg-accent/40",
};

export default function StatePanel({
  variant = "default",
  title,
  description,
  children,
  actions,
  className,
}: StatePanelProps) {
  return (
    <div
      className={cn(
        "rounded-md border px-5 py-8 sm:px-8 sm:py-10",
        variantStyles[variant],
        className
      )}
    >
      <div className="max-w-lg mx-auto space-y-4 text-center sm:text-left sm:mx-0 sm:max-w-none">
        {variant === "generating" && (
          <div className="h-0.5 w-full bg-muted overflow-hidden rounded-full">
            <div className="h-full w-full bg-primary animate-progress-rule origin-left" />
          </div>
        )}
        <div className="space-y-2">
          <p
            className={cn(
              "font-display text-xl font-semibold tracking-tight",
              variant === "error" ? "text-destructive" : "text-foreground"
            )}
          >
            {title}
          </p>
          {description && (
            <div className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </div>
          )}
        </div>
        {children}
        {actions && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center pt-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
