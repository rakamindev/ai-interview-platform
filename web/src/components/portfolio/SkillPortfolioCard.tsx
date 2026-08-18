import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
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

// Transcribed answers run long; observed quotes hit 300+ characters. Past this
// the card stops being scannable, so quotes collapse until asked for.
const LONG_QUOTE = 180;

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const [showFullQuotes, setShowFullQuotes] = useState(false);

  // No AI level when unassessed. An assessor can still rate it by hand, and then
  // the card behaves like any other.
  const effectiveLevel =
    override?.override_level ?? (skill.assessed ? parseLevel(skill.ai_level ?? "") : null);
  const unrated = effectiveLevel == null;
  const hasLongQuote = skill.evidence.some((q) => q.length > LONG_QUOTE);

  return (
    <Card data-testid="skill-card" className={unrated ? "border-dashed" : undefined}>
      <CardContent className="space-y-4 p-4">
        {/* Header. min-w-0 throughout so a long skill label wraps instead of
            pushing the override control off the card. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {unrated ? (
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                aria-label="Not assessed"
              >
                n/a
              </span>
            ) : (
              <LevelBadge level={effectiveLevel} />
            )}
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="break-words font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              {unrated ? (
                <span className="text-xs text-muted-foreground">Not assessed</span>
              ) : (
                <ConfidenceIndicator confidence={skill.ai_confidence ?? ""} />
              )}
            </div>
          </div>
          <div className="shrink-0">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {unrated && (
          <Callout variant="muted">
            The interview did not cover this skill, so there is no rating and no evidence for
            it. Rate it yourself only if you have grounds outside this session.
          </Callout>
        )}

        {skill.ai_confidence?.toLowerCase() === "low" && (
          <Callout variant="warning">
            Only briefly explored. Confidence is low — warrants a dedicated session if this
            skill matters.
          </Callout>
        )}

        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evidence from interview
            </span>
            {/* Speech-to-text, not a stenographic record. Saying so is the
                difference between a quote and an approximation of one. */}
            <p className="text-[11px] text-muted-foreground">
              Automatic transcription — wording may differ from what was said.
            </p>
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li
                  key={i}
                  className={`break-words text-sm text-foreground ${
                    showFullQuotes ? "" : "line-clamp-3"
                  }`}
                >
                  • "{quote}"
                </li>
              ))}
            </ul>
            {hasLongQuote && (
              <button
                type="button"
                onClick={() => setShowFullQuotes((v) => !v)}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {showFullQuotes ? "Show less" : "Show full quotes"}
              </button>
            )}
          </div>
        )}

        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Competency summary
            </span>
            <p className="break-words text-sm leading-relaxed text-muted-foreground">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
