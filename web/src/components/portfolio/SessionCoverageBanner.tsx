import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/types";

interface SessionCoverageBannerProps {
  summary: SessionSummary;
}

const END_REASON_LABELS: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  all_covered: { label: "All Skills Covered", tone: "success" },
  manual_candidate: { label: "Ended Early by Candidate", tone: "warning" },
  manual_assessor: { label: "Ended by Assessor", tone: "neutral" },
  time_ceiling: { label: "Time Limit Reached", tone: "neutral" },
  error: { label: "Interrupted by Error", tone: "warning" },
};

export function formatDurationSeconds(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return "Duration N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function SessionCoverageBanner({ summary }: SessionCoverageBannerProps) {
  const configured = summary.configured_skills_count ?? 0;
  const assessed = summary.assessed_skills_count ?? 0;
  const unassessed = summary.unassessed_skills_count ?? Math.max(0, configured - assessed);
  const covered = summary.covered_skills_count ?? 0;

  const pct = configured > 0 ? Math.round((assessed / configured) * 100) : 0;
  const reasonInfo = summary.end_reason
    ? END_REASON_LABELS[summary.end_reason] ?? {
        label: summary.end_reason.replace(/_/g, " "),
        tone: "neutral" as const,
      }
    : null;

  const isPartial = unassessed > 0;

  return (
    <section
      aria-label="Interview session coverage summary"
      className={cn(
        "rounded-[10px] border bg-white p-4 sm:px-5 sm:py-4 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        isPartial ? "border-amber-200/90" : "border-[#E2E8F0]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isPartial ? (
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-[#0F8F95] shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold text-[#1F2937]">
            {assessed} of {configured} configured skill{configured !== 1 ? "s" : ""} assessed
          </span>
          {reasonInfo && (
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-md border",
                reasonInfo.tone === "success" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                reasonInfo.tone === "warning" && "bg-amber-50 text-amber-900 border-amber-200",
                reasonInfo.tone === "neutral" && "bg-[#F7F9FA] text-[#64748B] border-[#E2E8F0]"
              )}
            >
              {reasonInfo.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{formatDurationSeconds(summary.duration_seconds)}</span>
        </div>
      </div>

      {configured > 0 && (
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label="Configured skills assessed"
            aria-valuenow={assessed}
            aria-valuemin={0}
            aria-valuemax={configured}
            className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
          >
            <div
              className={cn(
                "h-full transition-all",
                isPartial ? "bg-amber-500" : "bg-[#0F8F95]"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
            <span>
              {covered} fully covered · {Math.max(0, assessed - covered)} partially assessed
            </span>
            {unassessed > 0 && (
              <span className="text-amber-800 font-medium">
                {unassessed} unassessed (not penalized as low skill)
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
