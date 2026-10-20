import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
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

  const hasOverride = !!existingOverride;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(false);
    }
    setOpen(nextOpen);
  };

  const handleSave = async () => {
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {hasOverride && (
          <span className="text-xs font-medium text-primary">Human override saved</span>
        )}
        <DialogTrigger asChild>
          <Button variant={hasOverride ? "ghost" : "outline"} size="sm">
            {hasOverride && <Pencil className="mr-1 h-3 w-3" />}
            {hasOverride ? "Edit" : "Override rating"}
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-h-[min(680px,calc(100vh-2rem))] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>{hasOverride ? "Edit override" : "Override rating"}</DialogTitle>
          <DialogDescription>
            {hasOverride ? "Update" : "Adjust"} the reviewer rating for{" "}
            <span className="font-medium text-foreground">{skill.skill_label}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <Label className="text-sm font-medium">Your rating</Label>
            <div className="mt-3">
              <LevelRadio
                name={`override-${skill.id}`}
                label={`Your rating for ${skill.skill_label}`}
                value={overrideLevel}
                onChange={setOverrideLevel}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`notes-${skill.id}`}>
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add context for your override..."
            />
          </div>
          {saveError && <p className="text-sm text-destructive">Failed to save override. Please try again.</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
