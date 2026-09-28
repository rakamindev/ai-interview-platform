import { notify } from "@/components/ui/toast";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
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
  const [overrideLevel, setOverrideLevel] = useState(existingOverride?.override_level ?? parseLevel(skill.ai_level));
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    if (next) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(false);
    }
    setOpen(next);
  };
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await portfoliosApi.getOverride(skill.id, { override_level: overrideLevel, assessor_notes: notes });
      onSaved(res.data.override);
      notify("Recruiter override saved.");
      setOpen(false);
    } catch {
      setSaveError(true);
      notify("Could not save the override. Your edits are still here.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex flex-wrap items-center gap-2">
        {existingOverride && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            AI <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
            <span className="text-success">Recruiter override</span>
            <LevelBadge level={existingOverride.override_level} size="sm" />
          </span>
        )}
        <DialogTrigger asChild>
          <Button variant={existingOverride ? "ghost" : "outline"} size="sm">
            <Pencil /> {existingOverride ? "Edit override" : "Override rating"}
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent closeDisabled={saving} aria-busy={saving}>
        <DialogHeader>
          <DialogTitle>Override rating</DialogTitle>
          <DialogDescription>{skill.skill_label}. Your rating is recorded separately from the original AI evaluation.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Original AI rating</span>
          <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
        </div>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <fieldset disabled={saving} className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Your rating</legend>
            <LevelRadio value={overrideLevel} onChange={setOverrideLevel} disabled={saving} />
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${skill.id}`}>Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id={`notes-${skill.id}`} value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Explain the evidence behind your rating..." />
          </div>
          {saveError && <p role="alert" className="text-sm text-destructive">Could not save the override. Your rating and notes are still here; please try again.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving..." : "Save override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
