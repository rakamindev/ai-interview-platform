import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, Star, AlertTriangle, HelpCircle, UserCheck } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] || "bg-muted text-muted-foreground";

  let Icon = HelpCircle;
  let suffix = "";
  if (comparison.result === "match") {
    Icon = CheckCircle2;
  } else if (comparison.result === "exceed") {
    Icon = Star;
    suffix = comparison.delta ? ` (+${comparison.delta})` : "";
  } else if (comparison.result === "gap") {
    Icon = AlertTriangle;
    suffix = comparison.delta ? ` (${comparison.delta})` : "";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl shadow-sm border",
        classes
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-4">
      {/* Metric pills header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span><strong>{matchCount}</strong> Sesuai (Match)</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300 text-xs font-medium">
          <Star className="h-4 w-4 text-blue-500" />
          <span><strong>{exceedCount}</strong> Melebihi (Exceed)</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span><strong>{gapCount}</strong> Kesenjangan (Gap)</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-muted-foreground text-xs font-medium">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <span><strong>{notAssessedCount}</strong> Belum Diuji</span>
        </div>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider text-[11px]">
              <th className="text-left px-4 py-3.5 font-bold">Kompetensi</th>
              <th className="text-center px-4 py-3.5 font-bold">Standar Lowongan</th>
              <th className="text-center px-4 py-3.5 font-bold">Hasil Kandidat</th>
              <th className="text-center px-4 py-3.5 font-bold">Status Evaluasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {comparisons.map((c, i) => {
              const reqLevel = (c as any).expected_level ?? c.required_level;
              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-foreground">{c.skill_label}</td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground font-medium">
                    {reqLevel ? LEVEL_LABELS[reqLevel] || `L${reqLevel}` : "-"}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.candidate_level != null ? (
                      <div className="inline-flex items-center gap-1 font-bold text-foreground">
                        <span>{LEVEL_LABELS[c.candidate_level] || `L${c.candidate_level}`}</span>
                        {c.is_override && (
                          <span title="Disesuaikan oleh Asesor" className="inline-flex items-center text-purple-500">
                            <UserCheck className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Unassessed</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
