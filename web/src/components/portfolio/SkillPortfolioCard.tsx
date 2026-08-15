import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, CircleDashed } from "lucide-react";
import { ASSESSMENT_STATE_EXPLANATIONS, ASSESSMENT_STATE_LABELS } from "@/utils/constants";
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
  // Null when the skill was never assessed and no assessor has rated it. It is
  // deliberately not defaulted: `parseLevel(skill.ai_level)` used to return 1
  // for a missing level, so the UI reproduced the same fabricated L1 the
  // backend has now stopped writing.
  const effectiveLevel = override?.override_level ?? skill.ai_level;
  const unassessed = skill.assessment_state !== "assessed" && !override;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {effectiveLevel != null ? (
              <LevelBadge level={effectiveLevel} />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500"
                title={ASSESSMENT_STATE_LABELS[skill.assessment_state]}
              >
                <CircleDashed className="h-4 w-4" aria-hidden />
                <span className="sr-only">No rating</span>
              </span>
            )}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Why there is no rating — shown instead of, never alongside, a level */}
        {unassessed && (
          <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {ASSESSMENT_STATE_LABELS[skill.assessment_state]}.
            </span>{" "}
            {ASSESSMENT_STATE_EXPLANATIONS[skill.assessment_state]}
          </div>
        )}

        {/* Low confidence note */}
        {!unassessed && skill.ai_confidence === "low" && (
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
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground">
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
