import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, AlertTriangle } from "lucide-react";
import { m } from "@/paraglide/messages.js";
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
  onOverrideSaved
}: SkillPortfolioCardProps) {
  const rawLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const effectiveLevel = rawLevel || 1; // fallback to L1 when level is 0 (garbage input)

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Evidence (top — evidence-first hierarchy) */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {m.portfolio_evidence_from_interview()}
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote) => (
                <li key={quote} className="text-sm text-foreground line-clamp-3">
                  • "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Skill header with level badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-verdict-gap">
                    <Zap className="h-3 w-3" /> {m.portfolio_discovered()}
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
          <div className="text-xs text-muted-foreground bg-verdict-gap/10 border border-verdict-gap/20 rounded px-3 py-2">
            {m.portfolio_low_confidence_note()}
          </div>
        )}

        {/* Stale skill warning — override preserved but AI no longer reports */}
        {skill.ai_presence === "stale" && override && (
          <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-50 border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            AI no longer reports this skill — override preserved
          </Badge>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {m.portfolio_competency_summary()}
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
