import { Card } from "@/components/ui/card";
import Notice from "@/components/Notice";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
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
    <Card className="space-y-5 p-5">
      {/* Skill header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <LevelBadge level={effectiveLevel} />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{skill.skill_label}</span>
              {skill.is_discovered && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rakamin-yellow/25 px-2 py-0.5 text-xs font-medium text-rakamin-charcoal">
                  <Zap className="h-3 w-3" /> Discovered
                </span>
              )}
            </div>
            <ConfidenceIndicator confidence={skill.ai_confidence} />
          </div>
        </div>
        <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
      </div>

      {/* Low confidence note */}
      {skill.ai_confidence?.toLowerCase() === "low" && (
        <Notice variant="warning">
          Only briefly explored. Confidence is low — warrants a dedicated session if this skill
          matters.
        </Notice>
      )}

      {/* Evidence */}
      {skill.evidence.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-rakamin-teal">
            Evidence from interview
          </span>
          <ul className="space-y-2">
            {skill.evidence.map((quote, i) => (
              <li
                key={i}
                className="border-l-2 border-rakamin-teal bg-rakamin-light-cyan/40 py-1.5 pl-3 pr-2 text-sm"
              >
                "{quote}"
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Competency summary */}
      {skill.competency_summary && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-rakamin-teal">
            Competency summary
          </span>
          <p className="text-sm leading-relaxed text-rakamin-charcoal">
            {skill.competency_summary}
          </p>
        </div>
      )}
    </Card>
  );
}
