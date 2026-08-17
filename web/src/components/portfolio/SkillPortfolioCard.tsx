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

  const levelAccent: Record<number, string> = {
    1: "border-l-sky-300",
    2: "border-l-sky-400",
    3: "border-l-blue-500",
    4: "border-l-blue-700",
    5: "border-l-blue-900",
  };

  return (
    <Card
      className={`rounded-xl border-l-4 ${levelAccent[effectiveLevel] ?? "border-l-border"} shadow-sm hover:shadow-md transition-shadow duration-200`}
    >
      <CardContent className="p-5 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tracking-tight">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
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
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-2 bg-muted/40 rounded-lg p-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Evidence from interview
            </span>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground/90 italic border-l-2 border-border pl-3">
                  "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1 border-t pt-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
