import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { apiErrorMessage } from "@/services/api";
import { Loader2 } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
  onCancel: () => void;
}

const MAX_NOTES = 2000;

export default function OverridePanel({ skill, existingOverride, onSaved, onCancel }: OverridePanelProps) {
  const [overrideLevel, setOverrideLevel] = useState(existingOverride?.override_level ?? skill.ai_level ?? 3);
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const notesId = `override-notes-${skill.id}`;
  const errorId = `override-error-${skill.id}`;
  const notesMissing = notes.trim().length === 0;

  const handleSave = async () => {
    if (notesMissing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await portfoliosApi.saveOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved(res.data.override);
    } catch (e) {
      setSaveError(apiErrorMessage(e, "The override was not saved. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Your rating</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} className="flex-wrap" />
        {skill.ai_level != null && (
          <p className="text-xs text-muted-foreground">AI rating: L{skill.ai_level}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={notesId} className="text-sm">
          Reason for the change <span className="text-red-700">(required)</span>
        </Label>
        <Textarea
          id={notesId}
          value={notes}
          maxLength={MAX_NOTES}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          aria-describedby={saveError ? errorId : undefined}
          placeholder="What did you see that the AI rating missed? This is kept with the candidate's record."
        />
        <p className="text-xs text-muted-foreground">
          The fit/gap reports for this candidate are recalculated after you save.
        </p>
      </div>

      {saveError && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || notesMissing}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save override
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
