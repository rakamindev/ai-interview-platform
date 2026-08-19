import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil } from "lucide-react";
import type { SkillView } from "@/types";

interface OverridePanelProps {
  skill: SkillView;
  onSaved: () => void;
}

export default function OverridePanel({ skill, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(skill.override?.level ?? skill.effective_level ?? 3);
  const [notes, setNotes] = useState(skill.override?.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (open) return;
    setOverrideLevel(skill.override?.level ?? skill.effective_level ?? 3);
    setNotes(skill.override?.reason ?? "");
  }, [skill.override, skill.effective_level, open]);

  const handleSave = async () => {
    if (!skill.portfolio_skill_id || !notes.trim()) return;
    setSaving(true);
    setSaveError(false);
    try {
      await portfoliosApi.getOverride(skill.portfolio_skill_id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved();
      setOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant={skill.override ? "ghost" : "outline"} size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3 w-3 mr-1" />
        {skill.override ? "Edit override" : "Override"}
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Override rating</div>

      <div className="space-y-1.5">
        <Label className="text-sm">Your rating</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.portfolio_skill_id}`} className="text-sm">
          Reason <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id={`notes-${skill.portfolio_skill_id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why are you changing this rating? (recorded for the audit trail)"
        />
      </div>

      {saveError && <p className="text-xs text-destructive">Failed to save. Please try again.</p>}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !notes.trim()}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
  );
}
