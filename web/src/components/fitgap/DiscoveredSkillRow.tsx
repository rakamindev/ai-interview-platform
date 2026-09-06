import { toConfidencePhrase } from "@/utils/confidence";
import { LEVEL_LABELS } from "@/utils/constants";
import type { PortfolioSkill } from "@/types";

interface DiscoveredSkillRowProps {
  skill: PortfolioSkill;
}

/**
 * Satu baris "Discovered Skills" di Fit/Gap report.
 *
 * Diekstrak dari FitGapReportPage agar perilakunya bisa diuji tanpa router,
 * axios, dan polling — dan agar frasa confidence-nya dibaca dari satu sumber
 * yang sama dengan ConfidenceIndicator dan SkillPortfolioCard.
 */
export default function DiscoveredSkillRow({ skill }: DiscoveredSkillRowProps) {
  return (
    <div className="text-sm flex items-center gap-2">
      <span className="font-medium">{skill.skill_label}</span>
      <span className="text-muted-foreground">
        {LEVEL_LABELS[skill.ai_level]} ({toConfidencePhrase(skill.ai_confidence)})
      </span>
      <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
    </div>
  );
}
