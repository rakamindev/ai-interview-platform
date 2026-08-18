import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  disabled?: boolean;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  disabled = false,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  // Validate original AI level independently from override
  const isValidAiLevel =
    typeof skill.ai_level === "number" &&
    Number.isInteger(skill.ai_level) &&
    skill.ai_level >= 1 &&
    skill.ai_level <= 5;

  const effectiveLevel = override?.override_level ?? skill.ai_level;

  return (
    <Card className="min-w-0">
      <CardContent className="p-4 space-y-4 min-w-0">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            {isValidAiLevel ? (
              <LevelBadge level={effectiveLevel} />
            ) : (
              <div className="inline-flex flex-col items-center justify-center rounded font-semibold px-2 py-1 min-w-14 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200">
                <span>Rating unavailable</span>
              </div>
            )}
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold break-words [overflow-wrap:anywhere]">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600 shrink-0">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          {isValidAiLevel && !disabled && (
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          )}
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-1.5 min-w-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground break-words [overflow-wrap:anywhere] min-w-0">
                  • "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
