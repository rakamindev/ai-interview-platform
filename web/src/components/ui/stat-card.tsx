import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const iconVariants = cva("h-4 w-4 shrink-0", {
  variants: {
    tone: {
      neutral: "text-foreground",
      positive: "text-green-700",
      warning: "text-amber-700",
      muted: "text-slate-600",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface StatCardProps extends VariantProps<typeof iconVariants> {
  label: string;
  value: number;
  icon: LucideIcon;
  className?: string;
  // With onToggle the card is a toggle button (aria-pressed), e.g. a filter.
  pressed?: boolean;
  onToggle?: () => void;
}

// One summary number. The label and value are read together ("Match: 3").
export function StatCard({ label, value, icon: Icon, tone, className, pressed = false, onToggle }: StatCardProps) {
  const content = (
    <>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden="true" className={iconVariants({ tone })} />
        <span className="min-w-0 break-words">{label}</span>
      </span>
      <span className="text-2xl font-semibold tabular-nums leading-none">{value}</span>
    </>
  );
  const base = "flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-3";

  if (onToggle) {
    return (
      <button type="button" aria-pressed={pressed} aria-label={`${label}: ${value}`} onClick={onToggle}
              className={cn(base, "text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            pressed && "border-primary bg-primary/5 ring-1 ring-primary", className)}>
        {content}
      </button>
    );
  }

  return (
    <div role="group" aria-label={`${label}: ${value}`} className={cn(base, className)}>
      {content}
    </div>
  );
}
