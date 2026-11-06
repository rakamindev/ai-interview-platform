import { useId } from "react";
import { Pencil } from "lucide-react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

// Laporan lama memakai expected_level; laporan baru mengirim required_level (F-06).
const requiredLevel = (c: SkillComparison) => c.required_level ?? c.expected_level;

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

function CandidateLevel({ comparison: c }: { comparison: SkillComparison }) {
  if (c.candidate_level == null) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span className="font-medium">{LEVEL_LABELS[c.candidate_level]}</span>
      {c.is_override && (
        <>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 whitespace-nowrap">
            <Pencil className="h-3 w-3" aria-hidden />
            Corrected
          </span>
          {c.ai_level != null && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">AI {LEVEL_LABELS[c.ai_level]}</span>
          )}
        </>
      )}
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const correctionsId = useId();
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const corrections = comparisons.filter((c) => c.is_override);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => {
              const required = requiredLevel(c);
              return (
                <tr key={i} className="border-b last:border-0 align-top">
                  <td className="px-4 py-2.5 break-words min-w-[8rem]">{c.skill_label}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                    {required != null ? LEVEL_LABELS[required] : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <CandidateLevel comparison={c} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ringkasan */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        {corrections.length > 0 && (
          <span className="sm:ml-auto inline-flex items-center gap-1">
            <Pencil className="h-3 w-3" aria-hidden /> Corrected = level changed by an assessor
          </span>
        )}
      </div>

      {/* F-07: koreksi manusia dan alasannya terlihat oleh hiring manager */}
      {corrections.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
          <p id={correctionsId} className="text-xs font-semibold text-blue-900">
            Assessor corrections
          </p>
          <ul aria-labelledby={correctionsId} className="space-y-2">
            {corrections.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{c.skill_label}:</span>{" "}
                <span className="text-muted-foreground">
                  AI {c.ai_level != null ? LEVEL_LABELS[c.ai_level] : "?"} →{" "}
                  {c.candidate_level != null ? LEVEL_LABELS[c.candidate_level] : "—"}
                </span>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">
                  {c.override_reason || "No reason recorded (corrected before reasons were required)."}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
