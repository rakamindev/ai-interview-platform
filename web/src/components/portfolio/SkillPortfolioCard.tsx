// web/src/components/portfolio/SkillPortfolioCard.tsx
import { motion, type Variants } from "framer-motion";
import SkillLevelBadge from "./SkillLevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import EvidenceQuoteHighlight from "./EvidenceQuoteHighlight";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved?: (override: AssessorOverride) => void;
  customVariants?: Variants;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  customVariants,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const isOverridden = !!override?.override_level;

  return (
    <motion.div
      variants={customVariants}
      className="rounded-lg border bg-card p-4 space-y-3 shadow-sm"
    >
      {/* Skill header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{skill.skill_label}</span>
            {skill.is_discovered && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                <Zap className="h-3 w-3" /> Discovered
              </span>
            )}
            {isOverridden && (
              <span className="text-[10px] text-muted-foreground/70 border rounded px-1.5 py-0.5 font-medium">
                Override
              </span>
            )}
          </div>
          <ConfidenceIndicator confidence={skill.ai_confidence} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {effectiveLevel ? (
            <SkillLevelBadge level={effectiveLevel} size="md" />
          ) : null}
          {onOverrideSaved && (
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          )}
        </div>
      </div>

      {/* Unassessed or Low confidence note */}
      {skill.not_assessed ? (
        <div className="text-xs text-muted-foreground bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
          Skill ini belum sempat diprobe dalam sesi interview. Tidak ada rating L1–L5 yang difabrikasi demi objektivitas penilaian.
        </div>
      ) : (
        skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50/50 border border-amber-200/60 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )
      )}

      {/* Competency summary */}
      {skill.competency_summary && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {skill.competency_summary}
        </p>
      )}

      {/* Evidence Quotes with Collapsible animation */}
      {skill.evidence && skill.evidence.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Evidence from interview
          </span>
          <EvidenceQuoteHighlight quotes={skill.evidence} maxVisible={1} />
        </div>
      )}
    </motion.div>
  );
}
