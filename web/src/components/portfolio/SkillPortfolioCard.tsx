import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, Target, AlertTriangle } from "lucide-react";
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
  const isAssessed = skill.is_assessed ?? (skill.ai_level != null);
  const parsedAiLevel = isAssessed ? parseLevel(skill.ai_level) : 0;
  const effectiveLevel = override?.override_level ?? parsedAiLevel;

  return (
    <Card className="overflow-hidden transition-all hover:border-border/80">
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-foreground text-sm sm:text-base">
                  {skill.skill_label}
                </span>

                {skill.expected_level != null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                    <Target className="h-3 w-3" /> Target: L{skill.expected_level}
                  </span>
                )}

                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}

                {!isAssessed && !override && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Not Assessed
                  </span>
                )}
              </div>

              {isAssessed && (
                <div className="flex items-center gap-2">
                  <ConfidenceIndicator confidence={skill.ai_confidence} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 self-end sm:self-start">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {/* Human override banner & notes */}
        {override && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-md p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-amber-900">
              <span>✏</span>
              <span>
                Assessor Override Applied (AI evaluated:{" "}
                {parsedAiLevel > 0 ? `L${parsedAiLevel}` : "Not Assessed"} → L{override.override_level})
              </span>
            </div>
            {override.assessor_notes && (
              <p className="text-amber-800 leading-relaxed pl-4">
                "{override.assessor_notes}"
              </p>
            )}
          </div>
        )}

        {/* Unassessed explanation */}
        {!isAssessed && !override && (
          <div className="text-xs text-muted-foreground bg-muted/40 border rounded px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span>
              This skill was included in the assessment criteria, but was not actively probed or evaluated during the interview dialogue.
            </span>
          </div>
        )}

        {/* Low confidence note */}
        {isAssessed && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50/70 border border-amber-200 rounded px-3 py-2">
            Only briefly explored during the session. AI confidence is low — consider conducting a targeted follow-up if this competency is critical.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Evidence from interview transcript
            </span>
            <ul className="space-y-1.5 border-l-2 border-primary/20 pl-3">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-xs sm:text-sm text-foreground italic">
                  "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Competency Assessment Summary
            </span>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
