import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { coveragePercent, isReady } from "@/utils/evaluation";
import type { EvaluationSummary } from "@/types";

interface EvaluationSummaryPanelProps {
  summary?: EvaluationSummary | null;
}

export default function EvaluationSummaryPanel({ summary }: EvaluationSummaryPanelProps) {
  if (!summary) return null;

  const percent = coveragePercent(summary);
  const ready = isReady(summary);
  const { assessed, total } = summary.coverage;

  return (
    <div
      className={`border rounded-lg p-4 space-y-3 ${
        ready ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {ready ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          )}
          <div>
            <div className="font-semibold">
              {ready ? "Ready for review" : "Needs human review"}
            </div>
            <div className="text-sm text-muted-foreground">
              {assessed} of {total} competencies sufficiently assessed
            </div>
          </div>
        </div>
        <Badge variant={ready ? "default" : "destructive"}>{percent}% coverage</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Progress
          value={percent}
          className="h-2"
          indicatorClassName={ready ? "bg-green-500" : "bg-amber-500"}
        />
        <span className="text-xs text-muted-foreground w-12 text-right">{percent}%</span>
      </div>

      {!ready && summary.review_reasons.length > 0 && (
        <ul className="space-y-1 text-sm">
          {summary.review_reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}