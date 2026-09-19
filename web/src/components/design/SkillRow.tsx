import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SkillRowTone = "brand" | "warn" | "neutral";

const fillClasses: Record<SkillRowTone, string> = {
  brand: "bg-brand",
  warn: "bg-warn",
  neutral: "bg-[#c3cdd4]",
};

interface SkillRowProps {
  name: ReactNode;
  meta?: ReactNode;
  value: number;
  tone?: SkillRowTone;
  signal?: string | null;
  note?: ReactNode;
  className?: string;
}

export default function SkillRow({
  name,
  meta,
  value,
  tone = "brand",
  signal,
  note,
  className,
}: SkillRowProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">{name}</span>
        {meta && <span className="flex items-center gap-2">{meta}</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-border bg-surface-alt">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fillClasses[tone])}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      {signal && <p className="text-xs text-muted-foreground">&ldquo;{signal}&rdquo;</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
