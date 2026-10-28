import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { apiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

const MAX_NOTES = 2000;

const NOTE_REQUIRED_HINT: Record<string, string> = {
  not_assessed: "Required: this skill was not discussed, so say what your rating is based on.",
  needs_review: "Required: the AI rating could not be used, so say what your rating is based on.",
};

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
  onCancel: () => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved, onCancel }: OverridePanelProps) {
  const [level, setLevel] = useState<number | null>(existingOverride?.override_level ?? skill.ai_level);
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();
  const notesId = useId();

  // Mirrors the API rule: an override of a skill without an AI rating must say what it is based on.
  const noteHint = NOTE_REQUIRED_HINT[skill.assessment_status];
  const canSave = level != null && (!noteHint || notes.trim() !== "") && !saving;

  const handleSave = async () => {
    if (level == null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portfoliosApi.saveOverride(skill.id, { override_level: level, assessor_notes: notes });
      onSaved(res.data.override);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save the override. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="space-y-1.5">
        <Label id={labelId} className="text-sm">Your rating</Label>
        <LevelRadio value={level} onChange={setLevel} aria-labelledby={labelId} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={notesId} className="text-sm">
            Notes {noteHint ? "" : <span className="text-muted-foreground font-normal">(optional)</span>}
          </Label>
          <span className="text-xs text-muted-foreground tabular-nums">{`${notes.length} / ${MAX_NOTES}`}</span>
        </div>
        <Textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={MAX_NOTES}
          rows={3}
          placeholder={
            skill.ai_level == null
              ? "Where did you see this skill, and at what level?"
              : "What did you see that the AI rating does not reflect?"
          }
        />
        {noteHint && <p className="text-xs text-muted-foreground">{noteHint}</p>}
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
  );
}
