import { LEVEL_LABELS, LEVEL_DESCRIPTIONS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-amber-400",
  low: "bg-red-400",
};

function ConfidenceDot({ confidence }: { confidence?: string }) {
  if (!confidence) return <span className="text-muted-foreground">—</span>;
  const dotClass = CONFIDENCE_DOT[confidence.toLowerCase()] ?? "bg-neutral-400";
  return (
    <span className="inline-flex items-center gap-1 text-xs capitalize text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full inline-block", dotClass)} />
      {confidence.toLowerCase()}
    </span>
  );
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` −${Math.abs(comparison.delta)}` : "";
  } else {
    icon = "—";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

function LevelCell({ level, isOverride }: { level?: number; isOverride?: boolean }) {
  if (level == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium">{LEVEL_LABELS[level]}</span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {LEVEL_DESCRIPTIONS[level]}
      </span>
      {isOverride && (
        <span
          className="text-xs text-muted-foreground ml-0.5"
          title="Human override applied"
        >
          ✏
        </span>
      )}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const overrideCount = comparisons.filter((c) => c.is_override).length;

  if (comparisons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No skill comparisons available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Confidence</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b last:border-0 transition-colors",
                  c.result === "gap" && "bg-amber-50/40",
                  c.result === "exceed" && "bg-green-50/40",
                  c.result === "not_assessed" && "opacity-60"
                )}
              >
                <td className="px-4 py-2.5 font-medium">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {/* backward compat: old reports used expected_level */}
                  <LevelCell level={c.required_level ?? (c as any).expected_level} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <LevelCell level={c.candidate_level} isOverride={c.is_override} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ConfidenceDot confidence={c.confidence} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Override count — only show if relevant, no redundant match/gap counts */}
      {overrideCount > 0 && (
        <div className="text-xs text-muted-foreground">
          ✏ {overrideCount} human override{overrideCount !== 1 ? "s" : ""} applied
        </div>
      )}
    </div>
  );
}
