import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUp, Check, CircleDashed, CircleHelp, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { levelSource, resultExplanation, resultMeta, type Tone } from "@/lib/fitGap";
import LevelScale from "./LevelScale";
import type { SkillComparison } from "@/types";

const BADGE: Record<Tone, string> = {
  negative: "border-rose-200 bg-rose-50 text-rose-800",
  attention: "border-amber-300 bg-amber-50 text-amber-900",
  neutral: "border-border bg-muted/60 text-muted-foreground",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const ICON = {
  gap: ArrowDown,
  insufficient_evidence: CircleHelp,
  not_assessed: CircleDashed,
  match: Check,
  exceed: ArrowUp,
} as const;

interface SkillVerdictRowProps {
  comparison: SkillComparison;
  /** Where an assessor confirms a level; omitted when there is nothing to confirm. */
  reviewHref?: string;
}

export default function SkillVerdictRow({ comparison: c, reviewHref }: SkillVerdictRowProps) {
  const meta = resultMeta(c);
  const Icon = ICON[c.result];
  const explanation = resultExplanation(c);
  const source = levelSource(c);
  const shownLevel = c.candidate_level ?? (c.result === "insufficient_evidence" ? c.ai_level : null);

  const levelText =
    c.result === "not_assessed"
      ? `Not rated · L${c.expected_level} expected`
      : c.result === "insufficient_evidence"
        ? `AI suggested L${c.ai_level} (unconfirmed) · L${c.expected_level} expected`
        : `L${c.candidate_level} · L${c.expected_level} expected`;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-sm font-medium leading-snug">{c.skill_label}</h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            BADGE[meta.tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <LevelScale expected={c.expected_level} level={shownLevel} tone={meta.tone} label={levelText} />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{levelText}</span>
          {source && (
            <span className={cn("inline-flex items-center gap-1", c.overridden && "font-medium text-foreground")}>
              {c.overridden && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />}
              {source}
            </span>
          )}
        </p>
      </div>

      {explanation && (
        <div
          className={cn(
            "mt-2.5 rounded-md px-3 py-2 text-xs leading-relaxed",
            c.result === "insufficient_evidence" ? "bg-amber-50 text-amber-950" : "bg-muted/50 text-muted-foreground",
          )}
        >
          <p>{explanation}</p>
          {reviewHref && (
            <Link
              to={reviewHref}
              className="mt-1.5 inline-flex items-center gap-1 font-medium text-amber-900 underline-offset-2 hover:underline focus-visible:underline"
            >
              Review evidence and confirm a level
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
