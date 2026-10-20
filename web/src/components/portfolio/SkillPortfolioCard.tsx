import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import NotAssessedBadge from "./NotAssessedBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import ExpandableText from "./ExpandableText";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { NOT_ASSESSED_REASON_LABELS, parseLevel } from "@/utils/constants";
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
  const aiLevel = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevel;
  const reason = skill.not_assessed_reason ? NOT_ASSESSED_REASON_LABELS[skill.not_assessed_reason] : null;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header: stacks on a phone so the override panel never pushes the card wider (AC-29) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {effectiveLevel === null ? <NotAssessedBadge /> : <LevelBadge level={effectiveLevel} />}
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-semibold break-words">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-700">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              {/* Confidence describes the AI's rating, so there's none without one. */}
              {aiLevel !== null && <ConfidenceIndicator confidence={skill.ai_confidence ?? ""} />}
              {/* Why there's no level, in words, and what to do about it (AC-22). */}
              {aiLevel === null && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">{reason ?? "No level from the interview"}</span>. Probe it in the next interview, or
                  add a rating if you have evidence.
                </p>
              )}
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence note */}
        {aiLevel !== null && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-1.5 list-disc pl-5 marker:text-muted-foreground">
              {skill.evidence.map((quote) => (
                <li key={quote} className="text-sm text-foreground">
                  <ExpandableText text={`"${quote}"`} />
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
            <ExpandableText text={skill.competency_summary} className="text-sm text-muted-foreground leading-relaxed" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
