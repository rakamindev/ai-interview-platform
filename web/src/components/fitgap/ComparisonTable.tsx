import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const isNotAssessed = comparison.result === "not_assessed" || comparison.candidate_level == null;
  const resultKey = isNotAssessed ? "not_assessed" : comparison.result;
  const label = FIT_GAP_RESULT_LABELS[resultKey] || "Not assessed";
  const classes = FIT_GAP_RESULT_CLASSES[resultKey];

  let suffix = "";
  if (!isNotAssessed && comparison.result === "exceed" && comparison.delta) {
    suffix = ` (+${comparison.delta})`;
  } else if (!isNotAssessed && comparison.result === "gap" && comparison.delta) {
    suffix = ` (-${Math.abs(comparison.delta)})`;
  }

  return (
    <span className={cn("inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border", classes)}>
      {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Hitung metrik ringkasan dengan membedakan not_assessed dari gap yang sesungguhnya
  const notAssessedCount = comparisons.filter(
    (c) => c.result === "not_assessed" || c.candidate_level == null
  ).length;
  const matchCount = comparisons.filter(
    (c) => c.result === "match" && c.candidate_level != null
  ).length;
  const gapCount = comparisons.filter(
    (c) => c.result === "gap" && c.candidate_level != null
  ).length;
  const exceedCount = comparisons.filter(
    (c) => c.result === "exceed" && c.candidate_level != null
  ).length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Target Lowongan</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Capaian Kandidat</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status Evaluasi</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => {
              // Menangani perbedaan nama field antara backend (expected_level) dan frontend (required_level)
              const targetLevel = c.required_level ?? c.expected_level;
              const isNotAssessed = c.result === "not_assessed" || c.candidate_level == null;

              return (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <div>{c.skill_label}</div>
                    {isNotAssessed && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Belum ada bukti pengujian pada sesi wawancara
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground font-mono">
                    {targetLevel != null && LEVEL_LABELS[targetLevel]
                      ? LEVEL_LABELS[targetLevel]
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {!isNotAssessed && c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1 font-medium font-mono">
                        {LEVEL_LABELS[c.candidate_level]}
                        {c.is_override && (
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                            Manual
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Belum Diuji</span>
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

      {/* Ringkasan metrik evaluasi yang akurat */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1 pt-1">
        {matchCount > 0 && <span>Sesuai: {matchCount}</span>}
        {gapCount > 0 && <span className="text-rose-600 font-medium">Gap: {gapCount}</span>}
        {exceedCount > 0 && <span>Melebihi: {exceedCount}</span>}
        {notAssessedCount > 0 && <span>Belum Diuji: {notAssessedCount}</span>}
        <span className="ml-auto text-muted-foreground">Manual = Penyesuaian Asesor</span>
      </div>
    </div>
  );
}
