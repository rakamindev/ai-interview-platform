import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import EvidenceQuote from "./EvidenceQuote";
import { Zap } from "lucide-react";
import { isAssessed, UNRATED_SKILL_COPY } from "@/utils/skills";
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
  const assessed = isAssessed(skill);
  const effectiveLevel = assessed ? override?.override_level ?? skill.ai_level : null;
  const unratedCopy = skill.assessment_status === "assessed" ? null : UNRATED_SKILL_COPY[skill.assessment_status];

  return (
    <Card className={cn(!assessed && "border-dashed bg-muted/30 shadow-none")}>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-semibold break-words">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              {assessed ? (
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">{unratedCopy?.title}</span>
              )}
            </div>
          </div>
          {assessed && <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />}
        </div>

        {unratedCopy && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{unratedCopy.body}</p>
            <p>
              <span className="font-medium text-foreground">Next step:</span> cover this skill in a follow-up
              session before using it in a hiring decision.
            </p>
          </div>
        )}

        {assessed && skill.ai_confidence === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low, so confirm this rating in a dedicated session if the skill matters
            for the role.
          </div>
        )}

        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Evidence from the interview</span>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <EvidenceQuote key={i} quote={quote} />
              ))}
            </ul>
          </div>
        )}

        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {assessed ? "Competency summary" : "What was discussed"}
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed break-words">{skill.competency_summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
