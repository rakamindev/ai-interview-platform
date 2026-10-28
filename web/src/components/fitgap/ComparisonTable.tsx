import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultCell({ comparison }: { comparison: SkillComparison }) {
  const { result, delta, provisional } = comparison;
  const showDelta = (result === "gap" || result === "exceed") && delta;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn("text-xs font-medium px-2 py-0.5 rounded", FIT_GAP_RESULT_CLASSES[result])}>
        {FIT_GAP_RESULT_LABELS[result]}
        {showDelta && <span className="ml-1 tabular-nums">{delta > 0 ? `+${delta}` : delta}</span>}
      </span>
      {provisional && (
        <span
          className="text-xs text-muted-foreground border border-dashed rounded px-1.5 py-0.5"
          title="Based on a single interview question"
        >
          Provisional
        </span>
      )}
    </span>
  );
}

function CandidateCell({ comparison }: { comparison: SkillComparison }) {
  const { candidate_level, overridden, ai_level } = comparison;
  if (candidate_level == null) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span>{LEVEL_LABELS[candidate_level]}</span>
      {overridden && (
        <>
          <span className="text-[11px] text-primary">Set by assessor</span>
          <span className="text-[11px] text-muted-foreground">
            {ai_level == null ? "AI: not assessed" : `AI: ${LEVEL_LABELS[ai_level]}`}
          </span>
        </>
      )}
    </span>
  );
}

function summarize(comparisons: SkillComparison[]): [number, string][] {
  const count = (fn: (c: SkillComparison) => boolean) => comparisons.filter(fn).length;
  const firm = (c: SkillComparison) => !c.provisional;

  const counts: [number, string][] = [
    [count((c) => c.result === "match" && firm(c)), "match"],
    [count((c) => c.result === "exceed" && firm(c)), "exceeds"],
    [count((c) => c.result === "gap" && firm(c)), "gap"],
    [count((c) => c.provisional), "provisional"],
    [count((c) => c.result === "not_assessed"), "not assessed"],
    [count((c) => c.result === "needs_review"), "needs review"],
  ];
  return counts.filter(([n]) => n > 0);
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        This vacancy has no required skills to compare against.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Wide screens: table */}
      <div className="hidden sm:block rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-3 py-2.5 font-medium">Required</th>
              <th className="text-center px-3 py-2.5 font-medium">Candidate</th>
              <th className="text-left px-3 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => (
              <tr key={c.skill_label} className="border-b last:border-0 align-middle">
                <td className="px-4 py-2.5 break-words">{c.skill_label}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{LEVEL_LABELS[c.expected_level]}</td>
                <td className="px-3 py-2.5 text-center">
                  <CandidateCell comparison={c} />
                </td>
                <td className="px-3 py-2.5">
                  <ResultCell comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow screens: one block per skill, so the result never scrolls off-screen */}
      <ul className="sm:hidden divide-y rounded-lg border" aria-label="Skill comparison">
        {comparisons.map((c) => (
          <li key={c.skill_label} className="px-3 py-3 space-y-2">
            <p className="text-sm font-medium break-words">{c.skill_label}</p>
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Required {LEVEL_LABELS[c.expected_level]} · Candidate{" "}
                <span className="text-foreground">
                  {c.candidate_level == null ? "—" : LEVEL_LABELS[c.candidate_level]}
                </span>
                {c.overridden && <span className="block text-[11px] text-primary">Set by assessor</span>}
              </span>
              <ResultCell comparison={c} />
            </div>
          </li>
        ))}
      </ul>

      <ul aria-label="Summary" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {summarize(comparisons).map(([n, label]) => (
          <li key={label}>{`${n} ${label}`}</li>
        ))}
      </ul>
    </div>
  );
}
