import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiProps {
  value: ReactNode;
  unit?: string;
  label: string;
  icon?: ReactNode;
  className?: string;
}

export default function Kpi({ value, unit, label, icon, className }: KpiProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-baseline gap-1 font-display text-2xl font-semibold tracking-tight text-foreground">
        {value}
        {unit && <small className="font-sans text-xs font-medium text-muted-foreground">{unit}</small>}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
    </div>
  );
}
