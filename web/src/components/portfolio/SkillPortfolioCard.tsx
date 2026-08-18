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
    <Card className="shadow-none">
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="space-y-1">
              <LevelBadge level={effectiveLevel} />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
                {override ? "Final" : "AI"}
              </p>
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold break-anywhere">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
              {override && (
                <p className="text-xs text-muted-foreground break-anywhere">
                  AI suggested L{parseLevel(skill.ai_level)}; assessor set L{override.override_level}.
                </p>
              )}
            </div>
          </div>
          <div className="sm:pl-4">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {/* Weak / missing evidence */}
        {(!skill.evidence || skill.evidence.length === 0) && (
          <div className="text-xs text-muted-foreground bg-muted/60 border rounded px-3 py-2">
            No evidence quotes recorded for this skill. Treat the AI rating cautiously.
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
                <li key={i} className="text-sm text-foreground break-anywhere">
                  • &ldquo;{quote}&rdquo;
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
            <p className="text-sm text-muted-foreground leading-relaxed break-anywhere">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
