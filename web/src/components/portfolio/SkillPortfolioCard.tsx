import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

/**
 * Displays a single evaluated skill with its level badge, confidence indicator, candidate interview quotes, and competency summary.
 * Use it in candidate portfolio views to allow assessors to inspect evaluation details and submit score overrides.
 */
export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5 min-w-0">
              <h3 className="font-semibold break-words">{skill.skill_label}</h3>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored, so this rating is a guess. If the skill matters for the role, probe it in a follow-up round.
          </p>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">Candidate said</h4>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <li key={i}>
                  {/* Border marks quoted speech, the usual typographic convention */}
                  <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground break-words">
                    "{quote}"
                  </blockquote>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground">Competency summary</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
