import { useId, useRef, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { portfoliosApi } from "@/services/portfolios";
import type { AssessorOverride, PortfolioSkill } from "@/types";

interface RevertOverrideDialogProps {
  skill: PortfolioSkill;
  override: AssessorOverride;
  onReverted: () => void;
}

// Removes the assessor override after saying what happens: the AI level
// returns and the override stays in the history. A note is required.
export default function RevertOverrideDialog({ skill, onReverted }: RevertOverrideDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const savingRef = useRef(false);
  const revertedRef = useRef(false);
  const notesId = useId();

  const target = skill.ai_level ? `the AI rating (L${skill.ai_level})` : "Not assessed";

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setNotes("");
      setFailed(false);
      revertedRef.current = false;
    }
    setOpen(next);
  };

  const handleRevert = async () => {
    if (savingRef.current || notes.trim() === "") return;
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await portfoliosApi.revertOverride(skill.id, notes.trim());
      revertedRef.current = true;
      setOpen(false);
      onReverted();
    } catch {
      setFailed(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Undo2 aria-hidden="true" />
          Undo override{" "}<span className="sr-only">for {skill.skill_label}</span>
        </Button>
      </AlertDialogTrigger>
      {/* After undoing, this trigger disappears; the card moves focus itself. */}
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto"
                          onCloseAutoFocus={(e) => { if (revertedRef.current) e.preventDefault(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">{`Undo the override for ${skill.skill_label}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {`The skill goes back to ${target}. The override stays in the review history.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={notesId}>Reason for undoing (required)</Label>
          <Textarea id={notesId} required maxLength={2000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {failed && <Callout variant="error" role="alert" title="Could not undo the override. Try again." />}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleRevert} disabled={saving || notes.trim() === ""}>
            {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
            Undo override
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
