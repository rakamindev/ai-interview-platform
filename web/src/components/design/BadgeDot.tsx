import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "live" | "ok" | "warn" | "fail" | "neutral" | "ready";

const toneClasses: Record<BadgeTone, string> = {
  live: "bg-brand-soft text-brand-deep",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  fail: "bg-danger-soft text-danger",
  neutral: "bg-surface-alt text-muted-foreground",
  ready: "border border-border bg-surface-alt text-muted-foreground",
};

interface BadgeDotProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export default function BadgeDot({ tone = "neutral", children, className }: BadgeDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", tone === "live" && "animate-pulse")} />
      {children}
    </span>
  );
}
