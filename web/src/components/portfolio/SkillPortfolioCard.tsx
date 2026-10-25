import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel, { OverrideStatus } from "./OverridePanel";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride | null) => void;
  readOnly?: boolean;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  readOnly = false,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

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
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
              {!readOnly && <OverrideStatus skill={skill} existingOverride={override} />}
            </div>
          </div>
          {!readOnly && (
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          )}
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-muted-foreground dark:border-amber-700/70 dark:bg-amber-950/40">
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
