import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react";
import { FIT_GAP_RESULT_CLASSES, FIT_GAP_RESULT_LABELS, RATING_STATUS_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const RESULT_ICONS = { match: Check, exceed: ArrowUp, gap: ArrowDown, not_assessed: Minus } as const;

function levelText(level: number | null | undefined) {
  return level != null ? `L${level}` : "—";
}

export function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const Icon = RESULT_ICONS[comparison.result] ?? Minus;
  const delta =
    comparison.delta && comparison.result !== "not_assessed"
      ? ` ${comparison.delta > 0 ? "+" : "−"}${Math.abs(comparison.delta)}`
      : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium",
        FIT_GAP_RESULT_CLASSES[comparison.result]
      )}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {FIT_GAP_RESULT_LABELS[comparison.result]}
      {delta}
    </span>
  );
}

function SkillFlags({ comparison }: { comparison: SkillComparison }) {
  const flags: string[] = [];
  if (comparison.overridden) {
    flags.push(
      comparison.ai_level != null ? `Assessor override (AI said L${comparison.ai_level})` : "Assessor override"
    );
  }
  if (comparison.low_confidence) flags.push("Low confidence: verify before deciding");
  if (comparison.result === "not_assessed") {
    flags.push(`${RATING_STATUS_LABELS[comparison.rating_status ?? "missing"] ?? "Not assessed"}: not counted`);
  }
  if (flags.length === 0) return null;

  return (
    <ul className="mt-0.5 space-y-0.5">
      {flags.map((flag) => (
        <li
          key={flag}
          className={cn("text-xs", flag.startsWith("Low confidence") ? "text-amber-800" : "text-muted-foreground")}
        >
          {flag}
        </li>
      ))}
    </ul>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const count = (result: SkillComparison["result"]) => comparisons.filter((c) => c.result === result).length;
  const notAssessed = count("not_assessed");

  if (comparisons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This vacancy has no required skills yet. Add skills to the vacancy to compare candidates against it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Phone: one card per skill, so nothing scrolls sideways. */}
      <ul className="space-y-2 sm:hidden" aria-label="Skill comparison">
        {comparisons.map((c, i) => (
          <li key={`${c.skill_label}-${i}`} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words font-medium">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Required {levelText(c.expected_level)} · Candidate {levelText(c.candidate_level)}
            </p>
            <SkillFlags comparison={c} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">Skill</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Required</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Candidate</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={`${c.skill_label}-${i}`} className="border-b align-top last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="break-words">{c.skill_label}</span>
                  <SkillFlags comparison={c} />
                </th>
                <td className="px-4 py-2.5 text-center text-muted-foreground">{levelText(c.expected_level)}</td>
                <td className="px-4 py-2.5 text-center">{levelText(c.candidate_level)}</td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {count("match")} match · {count("exceed")} exceed · {count("gap")} gap
        {notAssessed > 0 && (
          <> · {notAssessed} not assessed (no evidence either way, not counted as a gap)</>
        )}
      </p>
    </div>
  );
}
