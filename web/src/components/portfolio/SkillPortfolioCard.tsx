import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, AlertTriangle } from "lucide-react";
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
  const isLowConfidence = skill.ai_confidence?.toLowerCase() === "low";
  const isUnassessed =
    effectiveLevel === 0 ||
    !skill.ai_level ||
    skill.ai_level === "0" ||
    skill.ai_confidence?.toLowerCase() === "unassessed";
  const needsManualReview = isLowConfidence || isUnassessed;

  return (
    <Card data-testid="skill-portfolio-card">
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-neutral-900">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
                {needsManualReview && (
                  <span
                    data-testid="manual-review-badge"
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                  >
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    Perlu Review Asesor Manual
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Compact subtle manual review notice */}
        {needsManualReview && (
          <p
            data-testid="manual-review-notice"
            className="text-xs text-amber-800/90 bg-amber-50/60 border border-amber-200/60 rounded px-3 py-1.5 flex items-center gap-2"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              {isUnassessed
                ? "Skill belum dieksplorasi mendalam selama wawancara otomatis. Disarankan verifikasi manual."
                : "Tingkat keyakinan AI masih rendah. Disarankan review manual jika kompetensi ini krusial."}
            </span>
          </p>
        )}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-neutral-700">
                  • "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-neutral-600 leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
