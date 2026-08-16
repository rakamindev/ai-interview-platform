import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import ClampText from "./ClampText";
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
  const isNotAssessed = skill.assessment_status === "not_assessed";
  const effectiveLevel = override?.override_level ?? (skill.ai_level != null ? parseLevel(skill.ai_level) : null);

  return (
    <Card className={isNotAssessed ? "border-dashed bg-muted/20" : undefined}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {effectiveLevel != null ? (
              <LevelBadge level={effectiveLevel} />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                —
              </div>
            )}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
                {isNotAssessed && (
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Not assessed
                  </span>
                )}
              </div>
              {!isNotAssessed && skill.ai_confidence && (
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              )}
              {skill.coverage_state && (
                <p className="text-xs text-muted-foreground">
                  Coverage: {skill.coverage_state.replace("_", " ")}
                  {skill.probe_count != null ? ` · ${skill.probe_count} probes` : ""}
                </p>
              )}
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {isNotAssessed && (
          <p className="text-sm text-muted-foreground">
            This skill was not discussed enough in the interview to assign a level.
          </p>
        )}

        {!isNotAssessed && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Low confidence — follow up if this skill matters for the role.
          </div>
        )}

        {!isNotAssessed && skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground">
                  <ClampText text={`"${quote}"`} className="text-sm text-foreground" maxLines={2} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {isNotAssessed ? "Status" : "Competency summary"}
            </span>
            <ClampText
              text={skill.competency_summary}
              className="text-sm text-muted-foreground leading-relaxed"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
