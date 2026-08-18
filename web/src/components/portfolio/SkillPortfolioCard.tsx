import { AlertCircle, ChevronDown, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { parseLevel } from "@/utils/constants";
import type { AssessorOverride, PortfolioSkill } from "@/types";
import ConfidenceIndicator from "./ConfidenceIndicator";
import LevelBadge from "./LevelBadge";
import OverridePanel from "./OverridePanel";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const isNotAssessed = skill.rating_status === "not_assessed" && !override;
  const effectiveLevel = isNotAssessed
    ? null
    : override?.override_level ?? parseLevel(skill.ai_level);
  const isLowConfidence = skill.ai_confidence?.toLowerCase() === "low";

  return (
    <Card className={isNotAssessed ? "border-amber-200 bg-amber-50/30" : undefined}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {effectiveLevel ? (
              <LevelBadge level={effectiveLevel} />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-100 px-1 text-center text-[10px] font-bold uppercase leading-tight text-amber-800">
                Not assessed
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="break-words font-semibold text-slate-950">
                  {skill.skill_label}
                </span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    Discovered
                  </span>
                )}
                {override && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                    Assessor override
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <div className="self-start">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {isNotAssessed && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-3 text-sm text-amber-950">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              Belum ada rating yang dapat dipertanggungjawabkan. Skill ini tidak ikut
              dihitung sebagai match atau gap sampai ada bukti penilaian.
            </p>
          </div>
        )}

        {isLowConfidence && !isNotAssessed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            Eksplorasi masih singkat. Confidence rendah berarti skill ini layak ditinjau
            kembali jika berdampak pada keputusan kandidat.
          </div>
        )}

        {skill.evidence.length > 0 ? (
          <details className="group rounded-xl border border-slate-200 bg-slate-50/70" open={skill.evidence.length <= 2}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Evidence from interview
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="space-y-2 border-t border-slate-200 px-3 py-3">
              {skill.evidence.map((quote, index) => (
                <li key={`${skill.skill_id}-${index}`} className="break-words text-sm leading-relaxed text-slate-700">
                  “{quote}”
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
            Belum ada evidence yang tersimpan untuk skill ini.
          </div>
        )}

        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Competency summary
          </span>
          <p className="break-words text-sm leading-relaxed text-slate-600">
            {skill.competency_summary || "Belum ada ringkasan kompetensi."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
