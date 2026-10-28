import { AlertTriangle, ArrowUp, Check, CircleHelp, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillComparisonResult } from "@/types";

const RESULT: Record<SkillComparisonResult, { label: string; icon: LucideIcon; className: string }> = {
  match: { label: "Match", icon: Check, className: "border-green-200 bg-green-50 text-green-800" },
  exceed: { label: "Exceeds", icon: ArrowUp, className: "border-green-200 bg-green-50 text-green-800" },
  gap: { label: "Gap", icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-900" },
  not_assessed: { label: "Not assessed", icon: CircleHelp, className: "border-slate-300 bg-slate-50 text-slate-800" },
  low_confidence: { label: "Low confidence", icon: ShieldAlert, className: "border-slate-300 bg-slate-50 text-slate-800" },
};

const TENTATIVE = { below: "Tentatively below", equal: "Tentatively matches", above: "Tentatively above" } as const;

export interface ResultBadgeProps {
  result: SkillComparisonResult;
  delta: number | null;
  tentativeDirection?: keyof typeof TENTATIVE | null;
  className?: string;
}

function suffix(result: SkillComparisonResult, delta: number | null): string {
  if (!delta) return "";
  if (result === "exceed") return ` +${delta}`;
  if (result === "gap") return ` -${Math.abs(delta)}`;
  return "";
}

// Icon plus text for every result; not counted results say so.
export function ResultBadge({ result, delta, tentativeDirection, className }: ResultBadgeProps) {
  const { label, icon: Icon, className: tone } = RESULT[result];
  let note: string | null = null;
  if (result === "not_assessed") note = "Not counted";
  if (result === "low_confidence") {
    note = `${tentativeDirection ? TENTATIVE[tentativeDirection] : "Tentative"}, not counted`;
  }

  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", tone)}>
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{`${label}${suffix(result, delta)}`}</span>
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </span>
  );
}
