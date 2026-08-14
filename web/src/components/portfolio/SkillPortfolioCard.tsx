import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelTrack from "@/components/assessment/LevelTrack";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

const MAX_VISIBLE_QUOTES = 2;

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const [showAllQuotes, setShowAllQuotes] = useState(false);

  const aiLevel = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevel;
  const hasOverride = !!override;
  const quotes = skill.evidence ?? [];
  const lowConfidence = skill.ai_confidence?.toLowerCase() === "low";
  const visibleQuotes = showAllQuotes ? quotes : quotes.slice(0, MAX_VISIBLE_QUOTES);
  const hiddenCount = quotes.length - MAX_VISIBLE_QUOTES;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Header — the level is the primary object */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium leading-snug [overflow-wrap:anywhere]">
                {skill.skill_label}
              </span>
              {skill.is_discovered && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Discovered
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <LevelTrack reached={effectiveLevel} size="sm" />
              <span className="font-mono text-sm tabular-nums">L{effectiveLevel}</span>
              {hasOverride && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground line-through">
                  L{aiLevel}
                </span>
              )}
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>

          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence — yellow attention, never red */}
        {lowConfidence && (
          <div className="flex items-start gap-2 rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />
            <p className="text-xs leading-relaxed text-attention">
              This skill was only briefly explored. Confidence is low — a dedicated
              follow-up session is recommended before treating this rating as reliable.
            </p>
          </div>
        )}

        {/* Evidence — the candidate's own words, serif */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Evidence from interview
          </span>
          {quotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No quotes captured for this skill.
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {visibleQuotes.map((quote, i) => (
                  <li key={i}>
                    <blockquote className="border-l-2 border-border pl-3 font-serif text-[15px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllQuotes((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAllQuotes ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Show all ({hiddenCount} more)
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Competency summary — the machine's conclusion, sans */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Competency summary
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
