import { Pencil } from "lucide-react";
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
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

function Level({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return <span>{LEVEL_LABELS[value]}</span>;
}

function OverrideMark() {
  return (
    <span
      className="inline-flex items-center text-muted-foreground"
      title="Rated by an assessor, not by the AI"
    >
      <Pencil className="h-3 w-3" aria-label="assessor override" />
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const count = (result: SkillComparison["result"]) =>
    comparisons.filter((c) => c.result === result).length;

  const summary = [
    { key: "match", icon: "✅", label: "Match", n: count("match") },
    { key: "gap", icon: "⚠", label: "Gap", n: count("gap") },
    { key: "exceed", icon: "⭐", label: "Exceeds", n: count("exceed") },
    // Counted like the rest. A skill nobody assessed is a fact about the report,
    // not an absence to leave out of it.
    { key: "not_assessed", icon: "—", label: "Not assessed", n: count("not_assessed") },
  ].filter((s) => s.n > 0);

  const anyOverridden = comparisons.some((c) => c.overridden);

  return (
    <div className="space-y-3">
      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">Skill</th>
              <th className="px-4 py-2.5 text-center font-medium">Required</th>
              <th className="px-4 py-2.5 text-center font-medium">Candidate</th>
              <th className="px-4 py-2.5 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={c.skill_label ?? i} className="border-b last:border-0">
                <td className="max-w-[16rem] break-words px-4 py-2.5">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  <Level value={c.expected_level} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center gap-1">
                    <Level value={c.candidate_level} />
                    {c.overridden && <OverrideMark />}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: same rows as cards. At 375px a four-column table is either cut
          off or unreadably cramped, and a hiring decision is read from it. */}
      <ul className="space-y-2 sm:hidden">
        {comparisons.map((c, i) => (
          <li key={c.skill_label ?? i} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words text-sm font-medium">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Required <Level value={c.expected_level} />
              </span>
              <span className="inline-flex items-center gap-1">
                Candidate <Level value={c.candidate_level} />
                {c.overridden && <OverrideMark />}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {summary.map((s) => (
          <span key={s.key}>
            {s.icon} {s.label}: {s.n} skill{s.n !== 1 ? "s" : ""}
          </span>
        ))}
        {/* Only claim a legend when a marker is actually on the page. */}
        {anyOverridden && (
          <span className="inline-flex items-center gap-1 sm:ml-auto">
            <Pencil className="h-3 w-3" aria-hidden /> = assessor override
          </span>
        )}
      </div>
    </div>
  );
}
