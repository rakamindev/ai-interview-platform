import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Check, TrendingUp, AlertTriangle, Minus, Pencil } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;

  let Icon = Minus;
  let suffix = "";
  let badgeStyle = "text-muted-foreground bg-muted border-border";

  if (comparison.result === "match") {
    Icon = Check;
    badgeStyle = "text-emerald-700 bg-emerald-50/80 border-emerald-200/80";
  } else if (comparison.result === "exceed") {
    Icon = TrendingUp;
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
    badgeStyle = "text-emerald-700 bg-emerald-50/80 border-emerald-200/80";
  } else if (comparison.result === "gap") {
    Icon = AlertTriangle;
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
    badgeStyle = "text-amber-700 bg-amber-50/80 border-amber-200/80";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 border select-none",
        badgeStyle
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      {/* Mobile & Tablet card view */}
      <Card className="lg:hidden rounded-none">
        <CardContent className="p-0 divide-y">
          {comparisons.map((c, i) => (
            <div key={i} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-sm text-foreground leading-snug">
                  {c.skill_label}
                </span>
                <div className="shrink-0">
                  <ResultBadge comparison={c} />
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span>Required:</span>
                  <span className="font-semibold text-foreground">
                    {LEVEL_LABELS[c.required_level ?? c.expected_level!]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Candidate:</span>
                  {c.candidate_level != null ? (
                    <span className="font-semibold text-foreground inline-flex items-center gap-1">
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && (
                        <span title="Human override applied" className="inline-flex items-center">
                          <Pencil className="h-3 w-3 text-primary" />
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Desktop table view */}
      <div className="hidden lg:block bg-card overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42%]">Skill</TableHead>
              <TableHead className="w-[18%] text-center">Required</TableHead>
              <TableHead className="w-[18%] text-center">Candidate</TableHead>
              <TableHead className="w-[22%] text-center">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-foreground py-3">
                  {c.skill_label}
                </TableCell>
                <TableCell className="text-center text-muted-foreground font-semibold py-3">
                  {LEVEL_LABELS[c.required_level ?? c.expected_level!]}
                </TableCell>
                <TableCell className="text-center font-semibold py-3">
                  {c.candidate_level != null ? (
                    <span className="inline-flex items-center justify-center gap-1">
                      <span>{LEVEL_LABELS[c.candidate_level]}</span>
                      {c.is_override && (
                        <span title="Human override applied" className="inline-flex items-center">
                          <Pencil className="h-3 w-3 text-primary" />
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center py-3">
                  <ResultBadge comparison={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary / Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground px-0.5">
        <div className="flex items-center gap-4 flex-wrap">
          {matchCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>
            </span>
          )}
          {gapCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>
            </span>
          )}
          {exceedCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 sm:ml-auto">
          <Pencil className="h-3 w-3 text-primary" />
          <span>= human override applied</span>
        </span>
      </div>
    </div>
  );
}
