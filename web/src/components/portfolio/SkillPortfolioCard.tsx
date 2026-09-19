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
    <div className="rounded-[14px] border border-border bg-card shadow-sm">
      {/* Skill header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <LevelBadge level={effectiveLevel} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold text-foreground">
                {skill.skill_label}
              </span>
              {skill.is_discovered && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3dd] px-2 py-0.5 text-[11px] font-semibold text-warn">
                  <Zap className="h-3 w-3" /> Discovered
                </span>
              )}
            </div>
            <div className="mt-1">
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
        </div>
        <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">
              Competency summary
            </span>
            <p className="text-sm leading-relaxed text-foreground">{skill.competency_summary}</p>
          </div>
        )}

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="rounded-[10px] border border-[#f2e0b3] bg-[#fdf3dd] px-3.5 py-2.5 text-xs text-warn">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill
            matters.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">
              Evidence from interview
            </span>
            <div className="space-y-2 rounded-[10px] bg-surface-alt px-3.5 py-3">
              {skill.evidence.map((quote, i) => (
                <p
                  key={i}
                  className="border-l-2 border-brand/50 pl-3 text-sm italic text-muted-foreground"
                >
                  “{quote}”
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
