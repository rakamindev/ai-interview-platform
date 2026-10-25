import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";
import { Link } from "react-router-dom";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
  transcriptPath: string;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  transcriptPath,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const lowConfidence = skill.ai_confidence?.toLowerCase() === "low";
  const insufficientEvidence = skill.evidence_status === "insufficient";

  return (
    <Card id={`skill-${skill.id}`} className="overflow-hidden shadow-sm">
      <CardContent className="space-y-5 p-4 sm:p-5">
        {/* Skill header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="break-words font-semibold leading-snug">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600 shrink-0">
                    <Zap className="h-3 w-3" aria-hidden="true" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {(lowConfidence || insufficientEvidence) && (
          <div
            role="status"
            className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Evidence quality
            </p>
            <ul className="space-y-1.5 text-xs leading-relaxed">
              {lowConfidence && (
                <li>
                  Only briefly explored. Confidence is low — warrants a dedicated session if this
                  skill matters.
                </li>
              )}
              {insufficientEvidence && (
                <li>
                  Insufficient verified transcript evidence. The skill assessment is retained, but
                  no candidate quote is presented as verified.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-2">
              {skill.evidence.map((citation, i) => (
                <li
                  key={`${citation.turn_id ?? "legacy"}-${i}`}
                  className="rounded-r-md border-l-2 border-primary/30 bg-muted/30 px-3 py-2.5 text-sm text-foreground"
                >
                  {citation.verification_status === "verified" && citation.turn_number ? (
                    <blockquote className="space-y-1.5">
                      <p className="break-words leading-relaxed">“{citation.quote}”</p>
                      <Link
                        to={`${transcriptPath}?turn=${citation.turn_number}`}
                        className="inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`View evidence in transcript, turn ${citation.turn_number}`}
                      >
                        Verified transcript turn {citation.turn_number}
                      </Link>
                    </blockquote>
                  ) : (
                    <blockquote className="space-y-1.5">
                      <p className="break-words leading-relaxed">“{citation.quote}”</p>
                      <p className="text-xs italic text-muted-foreground">
                        Legacy evidence — transcript link unavailable
                      </p>
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="break-words text-sm leading-relaxed text-foreground/80">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
