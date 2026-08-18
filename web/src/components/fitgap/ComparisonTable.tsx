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
  else icon = "⚪";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm border", classes)}>
      <span>{icon}</span> <span>{label}{suffix}</span>
    </span>
  );
}

function LevelVisualMeter({ level, maxLevel = 5, variant = "candidate" }: { level?: number | null; maxLevel?: number; variant?: "required" | "candidate" }) {
  if (level == null) return <span className="text-xs text-muted-foreground italic">Not assessed</span>;

  return (
    <div className="flex items-center gap-1.5" title={`Level ${level} of ${maxLevel}`}>
      <div className="flex gap-1">
        {Array.from({ length: maxLevel }).map((_, idx) => {
          const step = idx + 1;
          const isActive = step <= level;
          return (
            <div
              key={step}
              className={cn(
                "h-2 w-4 rounded-xs transition-all duration-300",
                isActive
                  ? variant === "candidate"
                    ? "bg-teal-600 dark:bg-teal-400 shadow-xs"
                    : "bg-primary/80"
                  : "bg-muted border border-border/40"
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-bold font-mono">L{level}</span>
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  const totalAssessed = comparisons.length - notAssessedCount;
  const matchPercentage = totalAssessed > 0 ? Math.round(((matchCount + exceedCount) / totalAssessed) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Top Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">Match Score</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">{matchPercentage}%</span>
            <span className="text-xs text-muted-foreground">overall fit</span>
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">Matches &amp; Exceeds</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-foreground">{matchCount + exceedCount}</span>
            <span className="text-xs text-muted-foreground">of {comparisons.length} skills</span>
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">Identified Gaps</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{gapCount}</span>
            <span className="text-xs text-muted-foreground">skill{gapCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">Not Assessed</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-muted-foreground">{notAssessedCount}</span>
            <span className="text-xs text-muted-foreground">skill{notAssessedCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-lg border shadow-xs bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3">Skill Requirement</th>
              <th className="text-left px-4 py-3">Required Target</th>
              <th className="text-left px-4 py-3">Candidate Assessment</th>
              <th className="text-center px-4 py-3">Fit Result</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparisons.map((c, i) => {
              const reqLevel = c.expected_level ?? c.required_level ?? 1;
              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {c.skill_label}
                  </td>
                  <td className="px-4 py-3">
                    <LevelVisualMeter level={reqLevel} variant="required" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <LevelVisualMeter level={c.candidate_level} variant="candidate" />
                      {c.is_override && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium" title="Human Assessor Override Applied">
                          ✏ Override
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-3">
          <span>✅ Match = Meets Target</span>
          <span>⭐ Exceeds = Above Target</span>
          <span>⚠️ Gap = Below Target</span>
          <span>⚪ Not Assessed = Unprobed</span>
        </div>
        <span className="italic">✏ Override = Adjusted by human assessor</span>
      </div>
    </div>
  );
}
