import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠️"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      {/* ── Summary pills ── */}
      <div className="flex flex-wrap items-center gap-2">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
            ✅ {matchCount} Match
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
            ⚠️ {gapCount} Gap
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            ⭐ {exceedCount} Exceeds
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">✏ = human override</span>
      </div>

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border">
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
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.required_level]}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && <span className="text-xs text-muted-foreground ml-1">✏</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (hidden on desktop) ── */}
      <div className="sm:hidden space-y-2.5">
        {comparisons.map((c, i) => (
          <div key={i} className="border rounded-xl p-3.5 space-y-2 bg-card">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div>
                <span className="block font-medium text-foreground/70 mb-0.5">Required</span>
                <span>{LEVEL_LABELS[c.required_level]}</span>
              </div>
              <div className="text-muted-foreground/40">→</div>
              <div>
                <span className="block font-medium text-foreground/70 mb-0.5">Candidate</span>
                <span>
                  {c.candidate_level != null ? (
                    <>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && <span className="ml-1">✏</span>}
                    </>
                  ) : "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
