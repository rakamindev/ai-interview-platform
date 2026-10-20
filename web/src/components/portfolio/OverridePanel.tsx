import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2 } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  onSaved: (override: AssessorOverride) => void;
  onCancel: () => void;
}

/** Inline form for the assessor's own rating. Opened from the skill card. */
export default function OverridePanel({ skill, onSaved, onCancel }: OverridePanelProps) {
  const existing = skill.override;
  // No preselected level for an unassessed skill: the assessor must choose one deliberately.
  const [level, setLevel] = useState<number | null>(existing?.override_level ?? skill.ai_level);
  const [notes, setNotes] = useState(existing?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesId = `override-notes-${skill.id}`;

  const handleSave = async () => {
    if (level == null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portfoliosApi.saveOverride(skill.id, { override_level: level, assessor_notes: notes });
      onSaved(res.data.override);
    } catch {
      setError("Couldn't save the rating. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/40 p-4">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{skill.assessed ? "Your rating" : "Rate this skill yourself"}</p>
        {!skill.assessed && (
          <p className="text-xs text-muted-foreground">
            The interview produced no evidence for this skill. Rate it only from evidence you have, such as a follow-up call.
          </p>
        )}
        <LevelRadio value={level} onChange={setLevel} aria-label={`Rating for ${skill.skill_label}`} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={notesId} className="text-sm">
          Reason <span className="font-normal text-muted-foreground">(shown in the report)</span>
        </Label>
        <Textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={skill.assessed ? "What did you see that the AI rating missed?" : "Where does this evidence come from?"}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || level == null}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save rating
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
