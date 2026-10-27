import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import { Collapse } from "@/components/motion/Collapse";
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

  const controls = (
      <div className="flex flex-wrap items-center gap-2">
        {hasOverride ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>AI</span>
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span aria-hidden>→</span>
              <span className="sr-only">changed to</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                <Pencil className="h-3 w-3" aria-hidden /> Assessor override
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="min-h-11 sm:min-h-9">
              Edit
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="min-h-11 sm:min-h-9">
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Override rating
          </Button>
        )}
      </div>
  );

  // Fragment: the controls and the form are separate items of the card header, so the form can wrap to full width.
  return (
    <>
      {!open && controls}
      <Collapse show={open} className="basis-full">
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <h4 className="text-sm font-semibold">Override the AI rating</h4>

      <div className="space-y-1.5">
        <Label className="text-sm">Your rating</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm">Why are you changing it? (optional)</Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What did you hear that the AI missed?"
        />
      </div>

      {saveError && (
        <p role="alert" className="text-xs text-red-700">The override was not saved. Check your connection and save again.</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving} className="min-h-11 sm:min-h-9">Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="min-h-11 sm:min-h-9">
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
      </Collapse>
    </>
  );
}
