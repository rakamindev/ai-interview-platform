import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, AlertCircle } from "lucide-react";
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
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-6">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <LevelBadge level={effectiveLevel} size="md" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                  {skill.skill_label}
                </h3>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 font-medium select-none">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              </div>
            </div>
          </div>
          <div className="shrink-0 sm:self-start">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
            </span>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
              Competency summary
            </span>
            <div className="p-4 bg-muted/30 border text-sm text-foreground leading-relaxed">
              {skill.competency_summary}
            </div>
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
              Evidence from interview
            </span>
            <div className="space-y-2">
              {skill.evidence.map((quote, i) => (
                <div
                  key={i}
                  className="border-l-2 border-primary/60 bg-muted/20 pl-4 pr-3 py-2.5 text-sm text-foreground italic leading-relaxed"
                >
                  "{quote}"
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
