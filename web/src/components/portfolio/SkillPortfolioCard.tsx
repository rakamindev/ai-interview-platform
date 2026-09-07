import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, Quote, Sparkles } from "lucide-react";
import { parseLevel, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

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
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card className="border border-slate-200 shadow-none hover:border-slate-300 transition-colors bg-white">
      <CardContent className="p-5 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <LevelBadge level={effectiveLevel} size="md" className="shrink-0" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-base">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Zap className="h-3 w-3" /> Discovered during session
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ConfidenceIndicator confidence={skill.ai_confidence} />
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 font-medium">
                  {LEVEL_LABELS[effectiveLevel]} ({LEVEL_DESCRIPTIONS[effectiveLevel]})
                </span>
              </div>
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            <span>Competency Scale</span>
            <span>Current: {LEVEL_LABELS[effectiveLevel]} - {LEVEL_DESCRIPTIONS[effectiveLevel]}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const isActive = lvl <= effectiveLevel;
              const isCurrent = lvl === effectiveLevel;
              return (
                <div
                  key={lvl}
                  className={`h-2 rounded-sm transition-all ${
                    isCurrent
                      ? "bg-emerald-600 ring-2 ring-emerald-600/30"
                      : isActive
                      ? "bg-emerald-400"
                      : "bg-slate-100"
                  }`}
                  title={`${LEVEL_LABELS[lvl]} (${LEVEL_DESCRIPTIONS[lvl]})`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>L1 Foundational</span>
            <span>L3 Proficient</span>
            <span>L5 Expert</span>
          </div>
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-md px-3.5 py-2.5 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Limited Exploration Depth</p>
              <p className="text-amber-700/90 text-[11px] mt-0.5">
                Only briefly explored during this session. AI confidence is low — consider a dedicated follow-up interview if this competency is critical.
              </p>
            </div>
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Quote className="h-3 w-3 text-slate-400" />
              Verifiable Candidate Evidence
            </div>
            <div className="space-y-1.5 bg-slate-50 border border-slate-200/70 rounded-md p-3">
              {skill.evidence.map((quote, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <span className="text-emerald-600 font-bold shrink-0">“</span>
                  <span className="italic">{quote}”</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Competency Assessment Summary
            </span>
            <div className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200/60 rounded-md p-3">
              {skill.competency_summary}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
