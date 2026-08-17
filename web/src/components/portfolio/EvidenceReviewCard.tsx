import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import { ReviewInlinePanel } from "./ReviewInlinePanel";
import { Zap, CheckCircle2, AlertTriangle, Link2, ExternalLink } from "lucide-react";
import { parseLevel, REVIEW_OUTCOME_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { PortfolioSkill, TranscriptTurn } from "@/types";

interface EvidenceReviewCardProps {
  skill: PortfolioSkill;
  /** transcript turns keyed by id, for evidence navigation */
  transcriptTurns?: TranscriptTurn[];
  onReviewSaved: (skillId: number) => void;
  onEvidenceClick?: (turnNumber: number) => void;
}

export default function EvidenceReviewCard({
  skill,
  transcriptTurns = [],
  onReviewSaved,
  onEvidenceClick,
}: EvidenceReviewCardProps) {
  const aiLevel = parseLevel(skill.ai_level);
  const effectiveLevel = parseLevel(skill.effective_level ?? skill.ai_level);
  const review = skill.review;
  const provenance = skill.evidence_provenance ?? [];

  const needsReview = !!skill.requires_review;

  return (
    <Card className={cn(needsReview && "border-amber-300")}>
      <CardContent className="p-4 space-y-4">
        {/* Header: skill + review status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <LevelBadge level={effectiveLevel} />
              {effectiveLevel == null && (
                <span className="text-[10px] font-medium text-muted-foreground">Not assessed</span>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>

          {/* Review status chip */}
          {review ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {REVIEW_OUTCOME_LABELS[review.outcome] ?? review.outcome}
            </span>
          ) : needsReview ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-neutral-50 text-neutral-500">
              OK
            </span>
          )}
        </div>

        {/* Requires-review reason banner */}
        {needsReview && !review && skill.review_reasons && skill.review_reasons.length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Flagged: {skill.review_reasons.join(", ").replace(/_/g, " ")}
          </div>
        )}

        {/* Evidence with provenance */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => {
                const prov = provenance[i];
                const verified = prov?.verified;
                const turn = prov?.turn_number;
                return (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="flex-1">
                      "{quote}"
                      {turn != null && onEvidenceClick && (
                        <button
                          onClick={() => onEvidenceClick(turn)}
                          className="inline-flex items-center gap-0.5 text-xs text-teal-700 hover:underline ml-1.5 align-baseline"
                        >
                          <Link2 className="h-3 w-3" /> turn {turn}
                        </button>
                      )}
                    </span>
                    {verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <span className="text-[10px] text-amber-600 shrink-0 mt-0.5 border border-amber-300 rounded px-1">
                        unverified
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Not-assessed / no-evidence note */}
        {skill.evidence.length === 0 && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
            No evidence quotes available for this skill.
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {skill.competency_summary}
            </p>
          </div>
        )}

        {/* Inline review panel */}
        <ReviewInlinePanel skill={skill} onSaved={onReviewSaved} />
      </CardContent>
    </Card>
  );
}
