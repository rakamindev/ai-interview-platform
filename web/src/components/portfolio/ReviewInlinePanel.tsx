import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Check, Pencil, Ban, ThumbsUp } from "lucide-react";
import { parseLevel, REVIEW_OUTCOME_LABELS } from "@/utils/constants";
import type { PortfolioSkill, ReviewOutcome } from "@/types";

interface ReviewInlinePanelProps {
  skill: PortfolioSkill;
  onSaved: (skillId: number) => void;
}

/**
 * Inline assessor review actions for a skill evaluation:
 *  - Confirm            → keep the AI level
 *  - Adjust             → supply a reviewed level 1..5 + rationale
 *  - Insufficient evidence → no level, rationale required
 */
export function ReviewInlinePanel({ skill, onSaved }: ReviewInlinePanelProps) {
  const [open, setOpen] = useState<ReviewOutcome | null>(null);
  const [reviewedLevel, setReviewedLevel] = useState<number>(() => parseLevel(skill.ai_level) ?? 3);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasReview = !!skill.review;

  const handleOpen = (outcome: ReviewOutcome) => {
    setOpen(outcome);
    setRationale(skill.review?.rationale ?? "");
    setReviewedLevel(skill.review?.reviewed_level ?? parseLevel(skill.ai_level) ?? 3);
    setError(null);
  };

  const handleSave = async () => {
    if (open === "adjusted" && (reviewedLevel < 1 || reviewedLevel > 5)) {
      setError("Choose a level between 1 and 5.");
      return;
    }
    if ((open === "adjusted" || open === "insufficient_evidence") && !rationale.trim()) {
      setError("A short rationale is required for this outcome.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await portfoliosApi.reviewSkill(skill.id, {
        outcome: open!,
        reviewed_level: open === "adjusted" ? reviewedLevel : null,
        rationale: rationale.trim() || undefined,
      });
      onSaved(skill.id);
      setOpen(null);
    } catch {
      setError("Failed to save review. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Collapsed state
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
        {hasReview ? (
          <span className="text-xs text-green-700 font-medium">
            {REVIEW_OUTCOME_LABELS[skill.review!.outcome] ?? skill.review!.outcome} ✓
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Review this evaluation:</span>
        )}
        <Button variant="outline" size="sm" onClick={() => handleOpen("confirmed")}>
          <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Confirm
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleOpen("adjusted")}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Adjust
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleOpen("insufficient_evidence")}>
          <Ban className="h-3.5 w-3.5 mr-1" /> Insufficient
        </Button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30 mt-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {REVIEW_OUTCOME_LABELS[open]}
      </div>

      {open === "confirmed" && (
        <p className="text-sm text-muted-foreground">
          Keep the AI-assigned level <strong>{skill.ai_level ?? "—"}</strong> for this skill.
        </p>
      )}

      {open === "adjusted" && (
        <div className="space-y-1.5">
          <Label className="text-sm">Reviewed level:</Label>
          <LevelRadio value={reviewedLevel} onChange={setReviewedLevel} />
        </div>
      )}

      {(open === "adjusted" || open === "insufficient_evidence") && (
        <div className="space-y-1.5">
          <Label htmlFor={`rationale-${skill.id}`} className="text-sm">
            Rationale {open === "insufficient_evidence" ? "(required)" : "(required)"}:
          </Label>
          <Textarea
            id={`rationale-${skill.id}`}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            placeholder={
              open === "insufficient_evidence"
                ? "Why is there not enough evidence to rate this skill?"
                : "Explain the adjustment..."
            }
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Save review
        </Button>
      </div>
    </div>
  );
}
