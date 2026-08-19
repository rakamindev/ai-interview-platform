import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
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
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card className="hover:shadow-md transition-all duration-300 border-border/60">
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="mt-0.5">
              <LevelBadge level={effectiveLevel} />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-lg leading-none">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <div className="pt-1">
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              </div>
            </div>
          </div>
          <div className="self-end sm:self-start">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 flex items-start gap-2 shadow-sm">
            <Zap className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <p>Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.</p>
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <div className="h-px bg-border flex-1" />
              Evidence from interview
              <div className="h-px bg-border flex-1" />
            </span>
            <ul className="space-y-2.5 mt-3">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground/90 pl-3 border-l-2 border-primary/30 italic">
                  "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Competency summary
            </span>
            <p className="text-sm text-foreground/80 leading-relaxed bg-muted/30 p-4 rounded-lg border border-border/50">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
