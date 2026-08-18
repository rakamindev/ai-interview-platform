import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

  const hasOverride = !!existingOverride;
  const aiLevel = parseLevel(skill.ai_level);

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

  if (!open) {
    return (
      <div className="space-y-1.5 text-right">
        {hasOverride ? (
          <>
            <div className="flex flex-wrap items-center justify-end gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground">AI</span>
              <LevelBadge level={aiLevel} size="sm" />
              <span className="text-muted-foreground text-xs">→</span>
              <span className="text-xs font-medium text-foreground">Assessor</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
            </div>
            <p className="text-xs text-green-700 font-medium">Human override in effect</p>
            {existingOverride!.assessor_notes?.trim() && (
              <p className="text-xs text-muted-foreground max-w-[220px] ml-auto line-clamp-2">
                “{existingOverride!.assessor_notes.trim()}”
              </p>
            )}
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit override
            </Button>
          </>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <span>AI rating</span>
              <LevelBadge level={aiLevel} size="sm" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" />
              Override with assessor rating
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30 text-left min-w-[240px]">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assessor override
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI rated <span className="font-medium text-foreground">L{aiLevel}</span>. Your level becomes the final hiring signal.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Assessor rating</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm">Why override? (recommended)</Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Strong system design answer; AI under-weighted architecture discussion."
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive">Failed to save override. Please try again.</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save assessor rating
        </Button>
      </div>
    </div>
  );
}
