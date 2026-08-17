import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import { CheckCircle2, PencilIcon, TrendingUp, TriangleAlert, Microscope } from "lucide-react";

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-amber-400",
  low: "bg-destructive",
};

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon: React.ReactNode = <span>—</span>;
  let suffix = "";
  if (comparison.result === "match") icon = <CheckCircle2 className="h-3.5 w-3.5" />;
  else if (comparison.result === "exceed") { icon = <TrendingUp className="h-3.5 w-3.5" />; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = <TriangleAlert className="h-3.5 w-3.5" />; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

function EvidenceCell({ comparison }: { comparison: SkillComparison }) {
  const confidence = comparison.confidence?.toLowerCase();
  const probes = comparison.probe_count;

  if (!confidence && probes == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {confidence && (
        <span className="inline-flex items-center gap-1 text-xs">
          <span className={cn("h-1.5 w-1.5 rounded-full", CONFIDENCE_DOT[confidence] ?? "bg-muted-foreground")} />
          {confidence}
        </span>
      )}
      {probes != null && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
          <Microscope className="h-3 w-3" />
          {probes} probe{probes !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Evidence</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{c.skill_label}</div>
                  {c.is_override && c.assessor_notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      Note: "{c.assessor_notes}"
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.required_level] ?? (c.expected_level ? `L${c.expected_level}` : "—")}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <div className="flex flex-col items-center">
                      <span className="inline-flex items-center font-medium">
                        {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                        {c.is_override && (
                          <PencilIcon className="h-3 w-3 text-amber-500 ml-1" />
                        )}
                      </span>
                      {c.is_override && c.ai_level != null && (
                        <span className="text-[10px] text-muted-foreground">
                          AI: L{c.ai_level} → Calibrated
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <EvidenceCell comparison={c} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <TriangleAlert className="h-3.5 w-3.5" /> Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <PencilIcon className="h-3 w-3" /> = human override applied
        </span>
      </div>
    </div>
  );
}
