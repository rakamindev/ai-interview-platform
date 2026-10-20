import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, Check } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? parseLevel(skill.ai_level)
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (open) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(false);
    }
  }, [open, existingOverride, skill.ai_level]);

  const hasOverride = !!existingOverride;

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
    <>
      <div className="flex items-center gap-2">
        {hasOverride ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-emerald-200 bg-emerald-50/70 text-emerald-900 select-none">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Overridden
              </span>
              <span className="text-emerald-400 font-light">•</span>
              <span className="font-medium text-emerald-800">
                AI <span className="font-bold text-foreground">L{parseLevel(skill.ai_level)}</span>
                <span className="mx-1 text-emerald-500">→</span>
                You <span className="font-bold text-foreground">L{existingOverride!.override_level}</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="h-8 gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit override
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-8 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> Override rating
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Override Rating: {skill.skill_label}</DialogTitle>
            <DialogDescription>
              Adjust the candidate's verified skill level and provide context for your manual evaluation.
            </DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Your rating:</Label>
              <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`notes-${skill.id}`} className="text-sm font-semibold">
                Notes (optional):
              </Label>
              <Textarea
                id={`notes-${skill.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add context for your override..."
              />
            </div>

            {saveError && (
              <p className="text-xs text-destructive">
                Failed to save override. Please try again.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
