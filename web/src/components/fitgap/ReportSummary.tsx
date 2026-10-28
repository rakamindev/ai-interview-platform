import { useId } from "react";
import { AlertTriangle, ArrowUp, Check, CircleHelp, ShieldAlert, UserCheck } from "lucide-react";
import { CoverageBar } from "@/components/ui/coverage-bar";
import { StatCard } from "@/components/ui/stat-card";
import type { FitGapSummary } from "@/types";

// Counts from the API summary; nothing is recomputed here.
export default function ReportSummary({ summary }: { summary: FitGapSummary }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="sr-only">Summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Match" value={summary.match} icon={Check} tone="positive" />
        <StatCard label="Exceeds" value={summary.exceed} icon={ArrowUp} tone="positive" />
        <StatCard label="Gap" value={summary.gap} icon={AlertTriangle} tone="warning" />
        <StatCard label="Not assessed" value={summary.not_assessed} icon={CircleHelp} tone="muted" />
        <StatCard label="Low confidence" value={summary.low_confidence} icon={ShieldAlert} tone="muted" />
        <StatCard label="Assessor reviewed" value={summary.overridden + summary.confirmed} icon={UserCheck} />
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-4">
        <CoverageBar value={summary.evidenced} total={summary.total} label="required skills have enough evidence to count" />
        <p className="text-sm text-muted-foreground">
          Missing evidence is not a reason to reject. Skills without enough evidence are not counted; they are listed
          under Follow up as questions for the next interview.
        </p>
      </div>
    </section>
  );
}
