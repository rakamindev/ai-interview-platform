import { parseLevel, LEVEL_LABELS } from "@/utils/constants";
import { toConfidencePhrase } from "@/utils/confidence";
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
 *
 * Level dibaca lewat parseLevel, bukan LEVEL_LABELS[skill.ai_level] langsung:
 * sejak backend mengizinkan ai_level null (level AI hilang ≠ L1), indexing
 * langsung akan merender `undefined` — data yang hilang menyamar jadi teks
 * kosong. Pola yang sama dengan bug confidence: yang hilang harus terlihat
 * sebagai hilang.
 */
export default function DiscoveredSkillRow({ skill }: DiscoveredSkillRowProps) {
  const level = parseLevel(skill.ai_level);

  return (
    <div className="text-sm flex items-center gap-2">
      <span className="font-medium">{skill.skill_label}</span>
      <span className="text-muted-foreground">
        {level == null ? "Unknown level" : LEVEL_LABELS[level]} ({toConfidencePhrase(skill.ai_confidence)})
      </span>
      <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
    </div>
  );
}
