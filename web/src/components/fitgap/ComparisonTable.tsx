import { useMemo, useState } from "react";
import {
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  LEVEL_BADGE_CLASSES,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
} from "@/utils/constants";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { SkillComparison, SkillComparisonResult } from "@/types";
import { ArrowUpDown, Pencil, ShieldAlert, Info } from "lucide-react";

/* ─── Confidence Badge ──────────────────────────────────────────────────── */

const CONFIDENCE_CONFIG: Record<
  string,
  { label: string; className: string; description: string }
> = {
  high: {
    label: "High",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Strong evidence from multiple interview signals",
  },
  medium: {
    label: "Med",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Moderate evidence; some signals were indirect",
  },
  low: {
    label: "Low",
    className: "bg-red-50 text-red-700 border-red-200",
    description: "Limited evidence; assessment may be unreliable",
  },
};

function ConfidenceBadge({
  confidence,
}: {
  confidence?: string | null;
}) {
  if (!confidence || !CONFIDENCE_CONFIG[confidence]) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const config = CONFIDENCE_CONFIG[confidence];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border cursor-default transition-colors",
              config.className
            )}
          >
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─── Result Badge ──────────────────────────────────────────────────────── */

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta
      ? ` ${comparison.delta}`
      : "";
  } else icon = "—";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap",
        classes
      )}
    >
      {icon} {label}
      {suffix}
    </span>
  );
}

/* ─── Level Cell ────────────────────────────────────────────────────────── */

function LevelCell({
  level,
  isOverride,
  muted,
}: {
  level?: number | null;
  isOverride?: boolean;
  muted?: boolean;
}) {
  if (level == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const levelLabel = LEVEL_LABELS[level] ?? `L${level}`;
  const levelDesc = LEVEL_DESCRIPTIONS[level] ?? "";
  const badgeClass = LEVEL_BADGE_CLASSES[level] ?? "bg-neutral-100 text-neutral-600";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 cursor-default",
              muted && "opacity-60"
            )}
          >
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded",
                badgeClass
              )}
            >
              {levelLabel}
            </span>
            {isOverride && (
              <Pencil className="h-3 w-3 text-blue-500 flex-shrink-0" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{levelLabel} — {levelDesc}</p>
          {isOverride && (
            <p className="text-blue-400 mt-0.5">✏ Assessor override applied</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─── Sorting ───────────────────────────────────────────────────────────── */

type SortField = "skill" | "result" | "delta";
type SortDir = "asc" | "desc";

const RESULT_PRIORITY: Record<SkillComparisonResult, number> = {
  gap: 0,
  not_assessed: 1,
  match: 2,
  exceed: 3,
};

function sortComparisons(
  list: SkillComparison[],
  field: SortField,
  dir: SortDir
): SkillComparison[] {
  const sorted = [...list].sort((a, b) => {
    let cmp = 0;
    if (field === "skill") {
      cmp = a.skill_label.localeCompare(b.skill_label);
    } else if (field === "result") {
      cmp =
        (RESULT_PRIORITY[a.result] ?? 99) - (RESULT_PRIORITY[b.result] ?? 99);
    } else if (field === "delta") {
      cmp = (a.delta ?? -99) - (b.delta ?? -99);
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/* ─── Summary Bar ───────────────────────────────────────────────────────── */

interface SummaryProps {
  comparisons: SkillComparison[];
}

function SummaryBar({ comparisons }: SummaryProps) {
  const total = comparisons.length;
  if (total === 0) return null;

  const counts = useMemo(() => {
    const c = { match: 0, gap: 0, exceed: 0, not_assessed: 0 };
    comparisons.forEach((comp) => {
      if (comp.result in c) c[comp.result as keyof typeof c]++;
    });
    return c;
  }, [comparisons]);

  const overrideCount = comparisons.filter((c) => c.is_override).length;

  // Visual bar segments
  const segments = [
    {
      key: "exceed",
      count: counts.exceed,
      color: "bg-emerald-500",
      label: "Exceeds",
    },
    {
      key: "match",
      count: counts.match,
      color: "bg-teal-400",
      label: "Match",
    },
    {
      key: "gap",
      count: counts.gap,
      color: "bg-amber-400",
      label: "Gap",
    },
    {
      key: "not_assessed",
      count: counts.not_assessed,
      color: "bg-neutral-300",
      label: "N/A",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Visual bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-neutral-100">
        {segments.map((seg) =>
          seg.count > 0 ? (
            <div
              key={seg.key}
              className={cn("h-full transition-all duration-500", seg.color)}
              style={{ width: `${(seg.count / total) * 100}%` }}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {counts.exceed > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            ⭐ Exceeds: {counts.exceed}
          </span>
        )}
        {counts.match > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-400" />
            ✅ Match: {counts.match}
          </span>
        )}
        {counts.gap > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            ⚠ Gap: {counts.gap}
          </span>
        )}
        {counts.not_assessed > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-neutral-300" />
            — Not assessed: {counts.not_assessed}
          </span>
        )}
        {overrideCount > 0 && (
          <span className="flex items-center gap-1 ml-auto">
            <Pencil className="h-3 w-3 text-blue-500" />
            {overrideCount} override{overrideCount !== 1 ? "s" : ""} applied
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Empty State ───────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">
        No skill comparisons available
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-[280px]">
        This may happen if the portfolio has no matching skills against the
        vacancy requirements, or the report is still being generated.
      </p>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>("result");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(
    () => sortComparisons(comparisons, sortField, sortDir),
    [comparisons, sortField, sortDir]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  if (!comparisons || comparisons.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("skill")}
                >
                  Skill
                  {sortField === "skill" && (
                    <ArrowUpDown className="h-3 w-3 text-primary" />
                  )}
                </button>
              </th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">
                Candidate
              </th>
              <th className="text-center px-4 py-2.5 font-medium hidden sm:table-cell">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-default">
                        Confidence
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      <p>
                        AI confidence in the skill level assessment, based on
                        interview signal strength and coverage depth.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
              <th className="text-center px-4 py-2.5 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("result")}
                >
                  Result
                  {sortField === "result" && (
                    <ArrowUpDown className="h-3 w-3 text-primary" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const isNotAssessed = c.result === "not_assessed";

              return (
                <tr
                  key={c.skill_id ?? i}
                  className={cn(
                    "border-b last:border-0 transition-colors",
                    isNotAssessed
                      ? "bg-neutral-50/50 text-muted-foreground"
                      : "hover:bg-muted/30"
                  )}
                >
                  <td
                    className={cn(
                      "px-4 py-2.5 max-w-[200px]",
                      isNotAssessed && "italic"
                    )}
                  >
                    <span className="line-clamp-2">{c.skill_label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <LevelCell level={c.required_level} muted={isNotAssessed} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <LevelCell
                      level={c.candidate_level}
                      isOverride={c.is_override}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    <ConfidenceBadge confidence={c.confidence} />
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
      <SummaryBar comparisons={comparisons} />
    </div>
  );
}
