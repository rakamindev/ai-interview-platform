import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { CircleDashed, TriangleAlert, Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, RatedSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

function isRated(skill: PortfolioSkill): skill is RatedSkill {
  return skill.ai_level !== null;
}

// A skill without a level says why, and shows no number, confidence or
// review button. The results page redesign replaces this card.
function AbsentSkillCard({ skill }: { skill: PortfolioSkill }) {
  const notReached = skill.status === "not_assessed";

  return (
    <Card data-skill-state={skill.status}>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{skill.skill_label}</span>
          {notReached ? (
            <span className="inline-flex items-center gap-1 rounded border border-dashed border-input px-1.5 py-0.5 text-xs text-muted-foreground">
              <CircleDashed className="h-3 w-3" aria-hidden="true" /> Not assessed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded border border-attention-line bg-attention-soft px-1.5 py-0.5 text-xs text-attention">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" /> Could not be evaluated
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {notReached
            ? "The interview did not reach this skill, so no level is given."
            : "The AI's answer for this skill couldn't be used, so no level is shown. This is a system problem, not a judgement of the candidate."}
        </p>
      </CardContent>
    </Card>
  );
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  if (!isRated(skill)) return <AbsentSkillCard skill={skill} />;

  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card data-skill-state={skill.status}>
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
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
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
