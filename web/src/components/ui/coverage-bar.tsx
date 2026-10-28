import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface CoverageBarProps {
  value: number;
  total: number;
  label: string;
  className?: string;
}

// "x of y <label>" as text first; the bar repeats it for sighted users.
export function CoverageBar({ value, total, label, className }: CoverageBarProps) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const text = `${value} of ${total} ${label}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium">{text}</p>
      <Progress value={percent} aria-label={text} className="bg-slate-200" />
    </div>
  );
}
