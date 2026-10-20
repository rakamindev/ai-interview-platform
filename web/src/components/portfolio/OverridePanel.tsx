import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import NotAssessedBadge from "./NotAssessedBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const aiLevel = parseLevel(skill.ai_level);
  // With no AI level there's nothing to preselect: the assessor has to choose.
  const [overrideLevel, setOverrideLevel] = useState<number | null>(existingOverride?.override_level ?? aiLevel);
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;
  // Rating a skill the AI didn't rate isn't an override of anything, and with no AI evidence underneath
  // the assessor has to say where the rating comes from (AC-20; the API refuses it otherwise).
  const noun = aiLevel === null ? "rating" : "override";
  const notesRequired = aiLevel === null;
  const canSave = overrideLevel !== null && (!notesRequired || notes.trim() !== "");

  const handleSave = async () => {
    if (!canSave || overrideLevel === null) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {hasOverride ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {aiLevel === null ? <NotAssessedBadge size="sm" /> : <LevelBadge level={aiLevel} size="sm" />}
              <span className="text-muted-foreground text-xs">AI</span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="text-xs text-green-700 font-medium">
                {aiLevel === null ? "Rated by you" : "Changed by you"} ✓
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit {noun}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {aiLevel === null ? "Add rating ▼" : "Override rating ▼"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {aiLevel === null ? "Add rating" : "Override"}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Your rating:</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm">
          {notesRequired ? "Where this rating comes from (required):" : "Notes (optional):"}
        </Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          required={notesRequired}
          placeholder={
            notesRequired
              ? "e.g. Probed in the second interview: designed the caching layer end to end"
              : "Add context for your override..."
          }
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive" role="alert">Failed to save {noun}. Please try again.</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save {noun}
        </Button>
      </div>
    </div>
  );
}
