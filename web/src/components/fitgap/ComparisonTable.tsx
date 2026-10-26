import { AlertCircle, Bot, PencilLine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import LevelTrack from "./LevelTrack";
import { NOT_ASSESSED_COPY, RESULT_META } from "./resultMeta";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  /** Dim rows while a newer version is being generated. */
  busy?: boolean;
}

function level(value: number | null) {
  return value != null ? `L${value}` : "—";
}

function ResultPill({ comparison }: { comparison: SkillComparison }) {
  const { label, icon: Icon, pill } = RESULT_META[comparison.result];
  const delta = comparison.delta;
  const suffix = delta != null && delta !== 0 ? ` ${delta > 0 ? "+" : "−"}${Math.abs(delta)}` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        pill
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
      {suffix && <span className="tabular-nums">{suffix}</span>}
    </span>
  );
}

function Provenance({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "not_assessed") return null;

  if (comparison.is_override) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilLine className="h-3 w-3" aria-hidden />
            Assessor override
            {comparison.ai_level != null && <span className="text-violet-500">· AI said L{comparison.ai_level}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          {comparison.assessor_notes ? `“${comparison.assessor_notes}”` : "No note was left for this override."}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Bot className="h-3 w-3" aria-hidden />
      AI rating{comparison.confidence ? ` · ${comparison.confidence} confidence` : ""}
    </span>
  );
}

export default function ComparisonTable({ comparisons, busy = false }: ComparisonTableProps) {
  return (
    <div className={cn("rounded-xl border bg-card transition-opacity", busy && "opacity-60")} aria-busy={busy}>
      <div className="hidden grid-cols-[minmax(0,1fr)_11rem_7.5rem] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
        <span>Skill</span>
        <span>Required vs candidate</span>
        <span className="text-right">Result</span>
      </div>

      <ul role="list" aria-label="Skill comparison">
        {comparisons.map((c, index) => (
          <li
            key={`${c.skill_id ?? c.skill_label}-${index}`}
            data-testid="comparison-row"
            className="grid grid-cols-1 gap-3 border-b px-4 py-3.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_11rem_7.5rem] sm:items-center sm:gap-4"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-3 sm:block">
                <p className="line-clamp-2 break-words text-sm font-medium leading-snug" title={c.skill_label}>
                  {c.skill_label}
                </p>
                <span className="shrink-0 sm:hidden">
                  <ResultPill comparison={c} />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Provenance comparison={c} />
                {c.needs_verification && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertCircle className="h-3 w-3" aria-hidden />
                    Limited evidence — verify
                  </span>
                )}
                {c.not_assessed_reason && (
                  <span className="text-[11px] text-muted-foreground">{NOT_ASSESSED_COPY[c.not_assessed_reason]}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:block sm:space-y-1.5">
              <LevelTrack required={c.expected_level} candidate={c.candidate_level} result={c.result} />
              <p className="text-xs tabular-nums text-muted-foreground">
                <span data-testid="candidate-level" className="font-semibold text-foreground">
                  {level(c.candidate_level)}
                </span>{" "}
                of <span data-testid="required-level">{level(c.expected_level)}</span> required
              </p>
            </div>

            <div className="hidden justify-end sm:flex">
              <ResultPill comparison={c} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
