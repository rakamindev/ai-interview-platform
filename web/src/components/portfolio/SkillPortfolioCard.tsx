import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, AlertTriangle } from "lucide-react";
import { parseLevel, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
  expectedLevel?: number;
}

function LevelPips({ level, expected }: { level: number; expected: number }) {
  return (
    <div className="space-y-1 mt-2.5">
      <div className="flex gap-[3px]">
        {Array.from({ length: 5 }, (_, i) => {
          const pipLevel = i + 1;
          const isFilled = pipLevel <= level;
          const isCurrent = pipLevel === level;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                isCurrent ? "bg-teal-600" : isFilled ? "bg-teal-400" : "bg-gray-200"
              )}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>L1</span>
        <span className={cn(level > 0 && "text-gray-700 font-medium")}>
          L{level} ← candidate
        </span>
        <span className="text-blue-700 font-semibold">L{expected} expected</span>
      </div>
    </div>
  );
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  expectedLevel = 3,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const confidence = skill.ai_confidence?.toLowerCase() ?? "low";
  const isLowConfidence = confidence === "low";

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3.5 px-5 py-4 border-b border-gray-200">
        <div className={cn(
          "w-[52px] h-[52px] rounded-[10px] flex flex-col items-center justify-center flex-shrink-0",
          effectiveLevel >= 3 ? "bg-blue-50" : effectiveLevel === 2 ? "bg-blue-50" : "bg-red-50"
        )}>
          <span className={cn(
            "text-lg font-bold leading-none",
            effectiveLevel >= 3 ? "text-blue-700" : effectiveLevel === 2 ? "text-blue-700" : "text-red-700"
          )}>
            {LEVEL_LABELS[effectiveLevel]}
          </span>
          <span className={cn(
            "text-[9px] font-semibold uppercase tracking-wider mt-0.5",
            effectiveLevel >= 3 ? "text-blue-700" : effectiveLevel === 2 ? "text-blue-700" : "text-red-700"
          )}>
            {LEVEL_DESCRIPTIONS[effectiveLevel]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-gray-900">
            {skill.skill_label}
            {skill.is_discovered && (
              <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 ml-1.5 font-normal">
                <Zap className="h-3 w-3" /> Discovered
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn(
              "w-[7px] h-[7px] rounded-full",
              confidence === "high" ? "bg-teal-500" : confidence === "medium" ? "bg-amber-500" : "bg-red-500"
            )} />
            <span className="text-xs text-gray-500 font-medium">
              Confidence: {confidence.toUpperCase()}
            </span>
          </div>
          <LevelPips level={effectiveLevel} expected={expectedLevel} />
        </div>

        <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
      </div>

      {/* Low confidence warning */}
      {isLowConfidence && (
        <div className="flex items-start gap-2.5 bg-amber-50 border-l-[3px] border-l-amber-300 px-5 py-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </p>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
              Evidence from interview
            </p>
            <div className="space-y-2">
              {skill.evidence.map((quote, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="text-teal-500 text-lg leading-none mt-[-2px] flex-shrink-0 font-serif">"</span>
                  <p className="text-[13px] text-gray-600 leading-[1.65] italic">{quote}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Competency summary
            </p>
            <p className="text-[13px] text-gray-600 leading-[1.75]">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
