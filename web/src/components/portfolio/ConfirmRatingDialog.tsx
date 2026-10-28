import { forwardRef, useId, useRef, useState, type FormEvent } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { probeText } from "@/components/ui/confidence-badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { levelText, saveErrorText } from "@/components/portfolio/reviewText";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

const CONFIDENCE = { high: "High", medium: "Medium", low: "Low" } as const;

interface ConfirmRatingDialogProps {
  skill: PortfolioSkill;
  onConfirmed: () => void;
}

// Records that an assessor agrees with the AI rating. A low-confidence
// rating needs a note, because confirming moves it into the fit/gap totals.
const ConfirmRatingDialog = forwardRef<HTMLButtonElement, ConfirmRatingDialogProps>(function ConfirmRatingDialog(
  { skill, onConfirmed },
  triggerRef,
) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const confirmedRef = useRef(false);
  const notesId = useId();

  const low = skill.ai_confidence === "low";
  const canConfirm = !saving && (!low || notes.trim() !== "");
  const confidence = skill.ai_confidence ? `${CONFIDENCE[skill.ai_confidence]} confidence` : "confidence unknown";

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setNotes("");
      setError(null);
      confirmedRef.current = false;
    }
    setOpen(next);
  };

  const handleConfirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!canConfirm || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await portfoliosApi.confirmRating(skill.id, notes.trim());
      confirmedRef.current = true;
      setOpen(false);
      onConfirmed();
    } catch (e) {
      setError(saveErrorText(e, "Could not confirm"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button ref={triggerRef} variant="outline" size="sm">
          <CheckCheck aria-hidden="true" />
          Confirm AI rating{" "}<span className="sr-only">for {skill.skill_label}</span>
        </Button>
      </DialogTrigger>
      {/* After a confirmation this trigger disappears; the card moves focus itself. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto"
                     onCloseAutoFocus={(e) => { if (confirmedRef.current) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="pr-6 [overflow-wrap:anywhere]">{`Confirm the AI rating: ${skill.skill_label}`}</DialogTitle>
          <DialogDescription>
            {`AI rating ${levelText(skill.effective_level ?? skill.ai_level)}, ${confidence}, ${probeText(skill.coverage?.probe_count)}. `}
            Confirming records that an assessor reviewed this rating; it then counts toward the fit/gap totals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4" noValidate>
          {low && (
            <Callout variant="warning" title="A note is required">
              Low-confidence ratings are not counted toward fit. Confirming moves this skill into the fit/gap
              totals, so say why the evidence is enough.
            </Callout>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={notesId}>{low ? "Note (required for a low-confidence rating)" : "Note (optional)"}</Label>
            <Textarea id={notesId} required={low} maxLength={2000} rows={3} value={notes}
                      onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <Callout variant="error" role="alert" title={error} />}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canConfirm}>
              {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
              Confirm rating
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default ConfirmRatingDialog;
