import { useState } from "react";
import LevelTrack from "@/components/assessment/LevelTrack";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { PencilLine } from "lucide-react";
import type { SkillComparison, SkillComparisonResult } from "@/types";

export interface ComparisonTableProps {
  comparisons: SkillComparison[];
  /** First verbatim quote per skill label, lower-cased key. Optional. */
  evidenceByLabel?: Record<string, string>;
}

type Filter = "all" | SkillComparisonResult;

const RESULT_COPY: Record<SkillComparisonResult, string> = {
  exceed: "Exceeds requirement",
  match: "Meets requirement",
  gap: "Below requirement",
  not_assessed: "Not assessed",
};

const RESULT_TEXT: Record<SkillComparisonResult, string> = {
  exceed: "text-result-exceed",
  match: "text-result-match",
  gap: "text-result-gap",
  not_assessed: "text-result-none",
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "match", label: "Meets" },
  { id: "gap", label: "Below" },
  { id: "exceed", label: "Exceeds" },
  { id: "not_assessed", label: "Not assessed" },
];

function tone(result: SkillComparisonResult) {
  return result === "not_assessed" ? "neutral" : result;
}

function DeltaReading({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "not_assessed") {
    return <span className="font-mono text-xs text-result-none">no reading</span>;
  }

  const delta = comparison.delta ?? 0;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        RESULT_TEXT[comparison.result],
        // A two-level shortfall has to look heavier than a one-level one
        // without the reader parsing the number.
        delta <= -2 && "font-medium",
      )}
    >
      {delta === 0 ? "on level" : sign}
    </span>
  );
}

export default function ComparisonTable({ comparisons, evidenceByLabel }: ComparisonTableProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = comparisons.reduce<Record<string, number>>((acc, c) => {
    acc[c.result] = (acc[c.result] ?? 0) + 1;
    return acc;
  }, {});

  const visible = filter === "all" ? comparisons : comparisons.filter((c) => c.result === filter);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(({ id, label }) => {
            const count = id === "all" ? comparisons.length : counts[id] ?? 0;
            if (id !== "all" && count === 0) return null;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === id
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
                <span className="font-mono tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t">
          {visible.map((c, i) => {
            const quote = evidenceByLabel?.[c.skill_label.toLowerCase()];
            const notAssessed = c.result === "not_assessed";

            return (
              <div
                key={`${c.skill_label}-${i}`}
                className={cn(
                  "grid gap-x-6 gap-y-3 border-b py-4",
                  "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)]",
                  notAssessed && "border-l-2 border-l-dashed border-l-border pl-3",
                )}
              >
                <div className="min-w-0">
                  <p className="break-words font-medium leading-snug [overflow-wrap:anywhere]">
                    {c.skill_label}
                  </p>
                  <p className={cn("mt-1 text-xs", RESULT_TEXT[c.result])}>{RESULT_COPY[c.result]}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Required / reached
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {LEVEL_LABELS[c.expected_level]}
                    </span>
                    <LevelTrack
                      reached={c.candidate_level ?? null}
                      required={c.expected_level}
                      tone={tone(c.result)}
                    />
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        notAssessed ? "text-result-none" : RESULT_TEXT[c.result],
                      )}
                    >
                      {c.candidate_level != null ? LEVEL_LABELS[c.candidate_level] : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DeltaReading comparison={c} />
                    {c.is_override && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <PencilLine className="h-3 w-3" />
                            Adjusted by assessor
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          An assessor reviewed this skill and corrected the AI's rating.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  {notAssessed ? (
                    <p className="text-xs text-muted-foreground">
                      The interview never covered this skill, so there is nothing to judge here.
                      Treat it as unknown, not as a weakness.
                    </p>
                  ) : quote ? (
                    // Serif marks words the candidate actually said, so evidence
                    // is never mistaken for the model's conclusion.
                    <blockquote className="border-l-2 border-border pl-3 font-serif text-[15px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  ) : (
                    <p className="text-xs text-muted-foreground">No quote captured for this skill.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No skills in this group.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
