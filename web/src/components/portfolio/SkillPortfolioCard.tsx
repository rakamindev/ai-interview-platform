import { useEffect, useId, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ClampText } from "@/components/ui/clamp-text";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { LevelScale } from "@/components/ui/level-scale";
import { LevelSourceMarker } from "@/components/ui/level-source-marker";
import ConfirmRatingDialog from "@/components/portfolio/ConfirmRatingDialog";
import OverridePanel from "@/components/portfolio/OverridePanel";
import ReviewHistory from "@/components/portfolio/ReviewHistory";
import RevertOverrideDialog from "@/components/portfolio/RevertOverrideDialog";
import { NOT_ASSESSED_MESSAGES, levelText } from "@/components/portfolio/reviewText";
import { parseLevel } from "@/utils/constants";
import type { AssessorOverride, PortfolioSkill } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
  // Called after any review action with a sentence to announce.
  onReviewChanged?: (message: string) => void;
  onConflict?: () => void;
}

function Evidence({ skill }: { skill: PortfolioSkill }) {
  if (skill.evidence.length === 0) {
    return <p className="text-sm text-muted-foreground">No quotes were recorded for this skill.</p>;
  }
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="evidence" className="border-b-0">
        <AccordionTrigger headingLevel={4} className="justify-start gap-1 rounded-sm py-1 text-sm text-teal-800 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>
            {`Evidence from the interview (${skill.evidence.length})`} <span className="sr-only">for {skill.skill_label}</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pt-2">
          <ul className="space-y-2">
            {skill.evidence.map((quote, index) => (
              <li key={index} className="border-l-2 pl-3 text-sm">
                <ClampText text={quote} lines={3} maxChars={300} />
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// One skill of the portfolio: level, confidence, source and evidence, with
// the review actions that apply to its current state.
export default function SkillPortfolioCard({ skill, override, onOverrideSaved, onReviewChanged, onConflict }: SkillPortfolioCardProps) {
  const headingId = useId();
  const ratingButtonRef = useRef<HTMLButtonElement>(null);
  const [focusRating, setFocusRating] = useState(false);

  const level = skill.effective_level ?? override?.override_level ?? parseLevel(skill.ai_level);
  const source = skill.level_source ?? null;
  const reviewed = source === "assessor_override" || source === "assessor_confirmed";
  const showConfidence = skill.ai_confidence && source !== "assessor_override";
  const canConfirm = skill.rating_status === "assessed" && !override && source !== "assessor_confirmed";

  // Confirm and Undo disappear once they succeed, so focus moves to the
  // rating button, which every card keeps.
  useEffect(() => {
    if (!focusRating) return;
    ratingButtonRef.current?.focus();
    setFocusRating(false);
  }, [focusRating]);

  const handleSaved = (saved: AssessorOverride) => {
    onOverrideSaved(saved);
    onReviewChanged?.(`Saved: ${skill.skill_label} is now L${saved.override_level} (assessor override).`);
  };

  const handleConfirmed = () => {
    setFocusRating(true);
    onReviewChanged?.(`Confirmed: ${skill.skill_label} stays at ${levelText(level)} and now counts as reviewed.`);
  };

  const handleReverted = () => {
    setFocusRating(true);
    const target = skill.ai_level ? `the AI rating (L${skill.ai_level})` : "Not assessed";
    onReviewChanged?.(`Undone: ${skill.skill_label} is back to ${target}.`);
  };

  return (
    <article aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={headingId} className="text-base font-semibold [overflow-wrap:anywhere]">{skill.skill_label}</h3>
            {skill.is_discovered && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-900">
                <Zap aria-hidden="true" className="h-3.5 w-3.5" /> Discovered
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LevelScale candidate={level} />
            <span className="text-sm font-medium">{level ? `L${level}` : "Not assessed"}</span>
            {showConfidence && skill.ai_confidence && (
              <ConfidenceBadge confidence={skill.ai_confidence} probeCount={skill.coverage?.probe_count} />
            )}
          </div>
          <LevelSourceMarker source={source} aiLevel={parseLevel(skill.ai_level)} review={skill.review} variant="detailed" />
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end max-sm:*:flex-1">
          <OverridePanel ref={ratingButtonRef} skill={skill} existingOverride={override} onSaved={handleSaved} onConflict={onConflict} />
          {canConfirm && <ConfirmRatingDialog skill={skill} onConfirmed={handleConfirmed} />}
          {override && <RevertOverrideDialog skill={skill} override={override} onReverted={handleReverted} />}
          <ReviewHistory skill={skill} />
        </div>
      </div>

      {level == null && (
        <p className="text-sm text-muted-foreground">
          {NOT_ASSESSED_MESSAGES[skill.not_assessed_reason ?? "not_covered"]}
        </p>
      )}
      {skill.ai_confidence === "low" && !reviewed && (
        <p className="text-sm text-muted-foreground">
          Only briefly explored. Low confidence is not counted toward fit until an assessor confirms or changes it.
        </p>
      )}
      {skill.competency_summary && <ClampText text={skill.competency_summary} className="text-sm" />}
      <Evidence skill={skill} />
    </article>
  );
}
