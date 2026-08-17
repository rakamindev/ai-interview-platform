import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import AssessmentStatusBadge from "./AssessmentStatusBadge";
import { Zap, ThumbsDown, MinusCircle } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride, EvaluationSkillSummary } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  evaluationSkill?: EvaluationSkillSummary;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  evaluationSkill,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const counterEvidence = evaluationSkill?.counter_evidence ?? skill.counter_evidence ?? [];
  const notAssessed = evaluationSkill?.assessment_status === "not_assessed";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
                {evaluationSkill && (
                  <span className="ml-1">
                    <AssessmentStatusBadge skill={evaluationSkill} />
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Not-assessed note */}
        {notAssessed && (
          <div className="text-xs text-muted-foreground bg-neutral-100 border border-neutral-200 rounded px-3 py-2 flex items-start gap-2">
            <MinusCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Not assessed — the interview did not produce enough evidence. No score was fabricated.
          </div>
        )}

        {/* Low confidence note */}
        {!notAssessed && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants human review if this skill matters.
          </div>
        )}

        {/* Supporting evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Supporting evidence
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground">
                  • "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Counter-evidence */}
        {counterEvidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <ThumbsDown className="h-3 w-3" /> Counter-evidence / gaps
            </span>
            <ul className="space-y-1">
              {counterEvidence.map((quote, i) => (
                <li key={i} className="text-sm text-amber-800">
                  • "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}