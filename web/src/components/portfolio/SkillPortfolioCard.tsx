import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLevel, LEVEL_BAR_CLASSES } from "@/utils/constants";
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
  const isAdjusted = !!override && override.override_level !== parseLevel(skill.ai_level);

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-y-0 left-0 w-1", LEVEL_BAR_CLASSES[effectiveLevel])} aria-hidden="true" />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-4">
          <LevelBadge level={effectiveLevel} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words font-semibold leading-tight">{skill.skill_label}</h3>
              {skill.is_discovered && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  <Zap aria-hidden="true" className="h-3 w-3" /> Discovered
                </span>
              )}
              {isAdjusted && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Adjusted by you
                </span>
              )}
            </div>
            <ConfidenceIndicator confidence={skill.ai_confidence} />
          </div>
        </div>

        {skill.competency_summary && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Competency summary
            </h4>
            <p className="break-words text-sm leading-6 text-foreground">
              {skill.competency_summary}
            </p>
          </div>
        )}

        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evidence from interview
            </h4>
            <ul className="space-y-2">
              {skill.evidence.map((quote, i) => (
                <li
                  key={i}
                  className="break-words border-l-2 border-primary/40 pl-3 text-sm leading-6 text-muted-foreground"
                >
                  &ldquo;{quote}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end border-t pt-3">
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>
      </CardContent>
    </Card>
  );
}
