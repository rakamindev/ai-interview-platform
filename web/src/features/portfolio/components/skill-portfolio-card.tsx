import { Zap } from "lucide-react";

import { Frame, FramePanel } from "@/components/ui/frame";

import type { AssessorOverride, PortfolioSkill } from "../schemas/portfolio";
import { parseLevel } from "@/utils/constants";
import { ConfidenceIndicator } from "./confidence-indicator";
import { LevelBadge } from "./level-badge";
import { OverridePanel } from "./override-panel";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export function SkillPortfolioCard({ skill, override, onOverrideSaved }: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Frame spacing="sm" dense>
      <FramePanel className="space-y-4">
        {/* Skill header */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="size-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence === "low" && (
          <div className="rounded border border-warning/32 bg-warning/4 px-3 py-2 text-xs text-muted-foreground">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Competency summary
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">{skill.competency_summary}</p>
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}
