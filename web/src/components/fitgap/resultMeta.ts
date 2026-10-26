import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDashed, type LucideIcon } from "lucide-react";
import type { NotAssessedReason, SkillComparisonResult } from "@/types";

interface ResultMeta {
  label: string;
  icon: LucideIcon;
  /** Pill / chip colours. */
  pill: string;
  /** Solid fill used by the level track and summary bar. */
  fill: string;
}

// Gap is amber, not red: a gap is something to probe, not a verdict.
export const RESULT_META: Record<SkillComparisonResult, ResultMeta> = {
  match: { label: "Meets", icon: CheckCircle2, pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", fill: "bg-emerald-500" },
  exceed: { label: "Exceeds", icon: ArrowUpRight, pill: "bg-teal-50 text-teal-700 ring-teal-600/20", fill: "bg-teal-600" },
  gap: { label: "Below", icon: ArrowDownRight, pill: "bg-amber-50 text-amber-800 ring-amber-600/25", fill: "bg-amber-500" },
  not_assessed: { label: "Not assessed", icon: CircleDashed, pill: "bg-slate-50 text-slate-600 ring-slate-400/30", fill: "bg-slate-300" },
};

export const RESULT_ORDER: SkillComparisonResult[] = ["match", "exceed", "gap", "not_assessed"];

export const NOT_ASSESSED_COPY: Record<NotAssessedReason, string> = {
  not_probed: "Not covered in the interview — no evidence either way.",
  invalid_rating: "The rating for this skill is unavailable.",
  invalid_expectation: "The vacancy has no valid required level for this skill.",
};
