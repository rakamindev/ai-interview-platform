import { AlertTriangle, Check, HelpCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { coveragePercent } from "@/lib/fitgap";
import type { FitGapSummary as Summary } from "@/types";

const STATS = [
  { key: "match", label: "Match", icon: Check, tone: "text-green-700" },
  { key: "exceed", label: "Exceeds", icon: Star, tone: "text-green-700" },
  { key: "gap", label: "Gap", icon: AlertTriangle, tone: "text-amber-700" },
  { key: "not_assessed", label: "Not assessed", icon: HelpCircle, tone: "text-neutral-500" },
] as const;

/** Coverage first: a verdict is only as good as the share of required skills actually assessed. */
export default function FitGapSummary({ summary }: { summary: Summary }) {
  const pct = summary.coverage_pct ?? coveragePercent(summary);
  const lowCoverage = pct !== null && pct < 60;

  return (
    <section aria-label="Assessment coverage" className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">Coverage of required skills</span>
          <span className="tabular-nums text-muted-foreground">
            {summary.assessed} of {summary.total} assessed{pct !== null ? ` · ${pct}%` : ""}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? 0}
          aria-label="Share of required skills assessed"
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-all", lowCoverage ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
        {lowCoverage && (
          <p className="text-xs text-amber-700">
            Less than 60% of the required skills were covered in this interview. Treat this comparison as partial.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATS.map(({ key, label, icon: Icon, tone }) => (
          <div key={key} className="rounded-lg border px-3 py-2">
            <dt className={cn("flex items-center gap-1.5 text-xs font-medium", tone)}>
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{summary[key]}</dd>
          </div>
        ))}
      </dl>

      {(summary.low_evidence > 0 || summary.overridden > 0) && (
        <p className="text-xs text-muted-foreground">
          {summary.low_evidence > 0 &&
            `${summary.low_evidence} ${summary.low_evidence === 1 ? "rating rests" : "ratings rest"} on limited evidence. `}
          {summary.overridden > 0 &&
            `${summary.overridden} ${summary.overridden === 1 ? "level was" : "levels were"} adjusted by an assessor.`}
        </p>
      )}
    </section>
  );
}
