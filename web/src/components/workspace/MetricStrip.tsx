import type { LucideIcon } from "lucide-react";

export interface MetricItem {
  label: string;
  value: number | string;
  icon: LucideIcon;
  className?: string;
}

interface MetricStripProps {
  items: MetricItem[];
}

export default function MetricStrip({ items }: MetricStripProps) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-secondary/10 sm:grid-cols-4 sm:divide-y-0">
      {items.map(({ label, value, icon: Icon, className }) => (
        <div key={label} className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className={`text-2xl font-semibold tracking-tight ${className ?? ""}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
