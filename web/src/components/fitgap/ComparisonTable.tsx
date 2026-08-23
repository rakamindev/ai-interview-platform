import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, TrendingUp, Minus, HelpCircle } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { SkillComparison, SkillComparisonResult } from "@/types";
import OverrideProvenance from "./OverrideProvenance";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  caption?: string;
  scope?: string;
}

const RESULT_ICONS: Record<SkillComparisonResult, React.ComponentType<{ className?: string }>> = {
  match: CheckCircle,
  gap: AlertTriangle,
  exceed: TrendingUp,
  insufficient_evidence: HelpCircle,
  not_assessed: Minus
};

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? FIT_GAP_RESULT_CLASSES.not_assessed;
  const Icon = RESULT_ICONS[comparison.result] ?? Minus;

  let suffix = "";
  if (comparison.result === "exceed" && comparison.delta) suffix = ` +${comparison.delta}`;
  else if (comparison.result === "gap" && comparison.delta)
    suffix = ` -${Math.abs(comparison.delta)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded",
        classes
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {suffix}
    </span>
  );
}

function ConfidenceDot({ confidence }: { confidence?: string }) {
  if (!confidence) return null;
  const c = confidence.toLowerCase();
  let color = "bg-verdict-unknown";
  if (c === "high") color = "bg-verdict-match";
  else if (c === "medium") color = "bg-verdict-gap";

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {c}
    </span>
  );
}

export default function ComparisonTable({ comparisons, caption, scope }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const insufficientCount = comparisons.filter((c) => c.result === "insufficient_evidence").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="text-left px-4 py-2.5 font-medium">
                {m.fitgap_table_skill()}
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                {m.fitgap_table_required()}
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                {m.fitgap_table_candidate()}
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                {m.fitgap_table_confidence()}
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                {m.fitgap_table_result()}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => (
              <tr key={c.skill_label} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <span>{c.skill_label}</span>
                  {scope && <span className="ml-1 text-xs text-muted-foreground">({scope})</span>}
                </td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.expected_level] ?? `L${c.expected_level}`}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span className="inline-flex items-center gap-1">
                      {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                      {c.is_override && (
                        <OverrideProvenance
                          actor={c.override_actor ?? undefined}
                          reason={c.override_reason ?? undefined}
                          at={c.override_at ?? undefined}
                        />
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ConfidenceDot confidence={c.confidence ?? undefined} />
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
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span>
            {m.fitgap_match()} {matchCount}
          </span>
        )}
        {gapCount > 0 && (
          <span>
            {m.fitgap_gap()} {gapCount}
          </span>
        )}
        {exceedCount > 0 && (
          <span>
            {m.fitgap_exceeds()} {exceedCount}
          </span>
        )}
        {insufficientCount > 0 && (
          <span>
            {m.fitgap_insufficient_evidence()} {insufficientCount}
          </span>
        )}
      </div>
    </div>
  );
}
