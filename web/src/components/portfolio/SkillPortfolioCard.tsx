import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, AlertCircle } from "lucide-react";
import { parseOptionalLevel, STATUS_REASON_LABELS } from "@/utils/constants";
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
  const parsedAiLevel = parseOptionalLevel(skill.ai_level);
  const status = skill.assessment_status || (parsedAiLevel ? "assessed" : "not_assessed");
  const isNotAssessed = status === "not_assessed" && !override;
  const isTentative = status === "insufficient_evidence" && !override;

  const effectiveLevel = override?.override_level ?? parsedAiLevel;

  const reasonLabel = skill.status_reason
    ? STATUS_REASON_LABELS[skill.status_reason] || skill.status_reason
    : "Tidak sempat dibahas di sesi ini";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isNotAssessed ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-300">
                Belum dinilai
              </span>
            ) : effectiveLevel != null ? (
              <div className="flex items-center gap-1.5">
                <LevelBadge level={effectiveLevel} />
                {isTentative && (
                  <span className="text-[11px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    Sementara
                  </span>
                )}
              </div>
            ) : null}

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>

              {!isNotAssessed && skill.ai_confidence && (
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              )}
            </div>
          </div>

          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Not assessed explanation */}
        {isNotAssessed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
            <AlertCircle className="h-4 w-4 text-neutral-500 shrink-0" />
            <span>{reasonLabel}</span>
          </div>
        )}

        {/* Low confidence / tentative note */}
        {isTentative && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Bukti wawancara masih tipis — disarankan verifikasi manual atau sesi pendalaman jika skill ini penting.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
