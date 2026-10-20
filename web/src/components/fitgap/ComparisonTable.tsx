import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const isNotAssessed = comparison.result === "not_assessed";
  const label = isNotAssessed
    ? comparison.reason === "not_in_interview"
      ? "Di luar sesi"
      : "Belum dinilai"
    : FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;

  const classes = isNotAssessed
    ? "text-neutral-600 bg-neutral-100 border border-neutral-200"
    : FIT_GAP_RESULT_CLASSES[comparison.result] || "text-neutral-600 bg-neutral-50";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") {
    icon = "✅";
  } else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else {
    icon = "⚪";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

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
              const reqLevel = c.required_level ?? c.expected_level;
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{c.skill_label}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                    {reqLevel != null && LEVEL_LABELS[reqLevel] ? LEVEL_LABELS[reqLevel] : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.candidate_level != null && LEVEL_LABELS[c.candidate_level] ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <span>{LEVEL_LABELS[c.candidate_level]}</span>
                        {c.is_override && (
                          <span
                            className="text-xs text-muted-foreground cursor-help"
                            title="Nilai hasil koreksi manual assessor"
                          >
                            ✏
                          </span>
                        )}
                        {c.tentative && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-normal">
                            Sementara
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500 font-normal">Belum dinilai</span>
                    )}
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

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        {notAssessedCount > 0 && <span>⚪ Belum dinilai: {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""}</span>}
        <span className="ml-auto text-[11px]">✏ = human override applied</span>
      </div>
    </div>
  );
}
