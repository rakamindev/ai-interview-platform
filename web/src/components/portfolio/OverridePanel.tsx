import { forwardRef, useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "@/components/assessment/LevelRadio";
import { levelText, saveErrorText, sourceText } from "@/components/portfolio/reviewText";
import { portfoliosApi } from "@/services/portfolios";
import { isConflict } from "@/utils/apiError";
import { parseLevel } from "@/utils/constants";
import type { AssessorOverride, PortfolioSkill } from "@/types";

const MAX_NOTES = 2000;

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
  // Called when the server says someone else changed the rating (409), so
  // the page can load the latest values while this dialog keeps the input.
  onConflict?: () => void;
}

type SaveError = { conflict: boolean; text: string };

// Sets or changes the assessor level of one skill in a dialog. The note is
// required, the current level is rejected on the client, and a failed save
// never discards what the assessor typed.
const OverridePanel = forwardRef<HTMLButtonElement, OverridePanelProps>(function OverridePanel(
  { skill, existingOverride, onSaved, onConflict },
  triggerRef,
) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const savingRef = useRef(false);
  const notesId = useId();
  const counterId = useId();
  const hintId = useId();

  const aiLevel = parseLevel(skill.ai_level);
  const current = existingOverride?.override_level ?? skill.effective_level ?? aiLevel;
  const sameLevel = level >= 1 && level === current;
  const canSave = level >= 1 && !sameLevel && notes.trim() !== "" && !saving;
  const triggerLabel = existingOverride ? "Change rating" : current == null ? "Rate manually" : "Override rating";

  let hint: string | null = null;
  if (sameLevel) hint = `L${level} is already the current level. Choose a different level.`;
  else if (level < 1 || notes.trim() === "") hint = "Choose a level and write a reason to save.";

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setLevel(0);
      setNotes("");
      setError(null);
      setShowLatest(false);
    }
    setOpen(next);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: level,
        assessor_notes: notes.trim(),
        lock_version: existingOverride?.lock_version,
      });
      setOpen(false);
      onSaved(res.data.override);
    } catch (e) {
      setError(isConflict(e)
        ? { conflict: true, text: "This skill was changed by someone else" }
        : { conflict: false, text: saveErrorText(e, "Could not save") });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const loadLatest = () => {
    setShowLatest(true);
    onConflict?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button ref={triggerRef} variant="outline" size="sm">
          <Pencil aria-hidden="true" />
          {triggerLabel}
          {/* Every card has this button; the hidden suffix tells them apart for screen readers. */}
          {" "}<span className="sr-only">for {skill.skill_label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 [overflow-wrap:anywhere]">{`Override rating: ${skill.skill_label}`}</DialogTitle>
          <DialogDescription>
            AI rating: {levelText(aiLevel)}. Your rating replaces it in the portfolio and the fit/gap report; the
            change is kept in the review history.
          </DialogDescription>
          {existingOverride && (
            <p className="text-sm font-medium">{`Current rating: L${existingOverride.override_level} (assessor override)`}</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Your rating</legend>
            <LevelRadio value={level} onChange={setLevel} label={`New level for ${skill.skill_label}`} />
          </fieldset>

          <p aria-live="polite" className="text-sm font-medium">
            {level >= 1 ? `AI ${aiLevel ? `L${aiLevel}` : "not assessed"}, your rating L${level}` : ""}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor={notesId}>Reason for the change (required)</Label>
            <Textarea id={notesId} required maxLength={MAX_NOTES} rows={4} value={notes}
                      aria-describedby={counterId} onChange={(e) => setNotes(e.target.value)}
                      placeholder="What evidence supports this rating?" />
            <p id={counterId} className="text-right text-xs text-muted-foreground">{`${notes.length} / ${MAX_NOTES}`}</p>
          </div>

          {error && (
            <Callout variant="error" role="alert" title={error.text}
                     action={error.conflict ? (
                       <Button type="button" size="sm" variant="outline" onClick={loadLatest}>Load the latest rating</Button>
                     ) : undefined}>
              {error.conflict ? "Your level and note are kept. Load the latest rating, check it, then save again." : null}
            </Callout>
          )}
          {showLatest && (
            <p className="text-sm font-medium">
              {`Latest rating: ${levelText(skill.effective_level ?? null)} (${sourceText(skill.level_source ?? null)})`}
            </p>
          )}

          {hint && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSave} aria-describedby={hint ? hintId : undefined}>
              {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
              Save override
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default OverridePanel;
