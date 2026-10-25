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
      <div className="flex items-center gap-2">
        {hasOverride ? (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground text-xs">AI</span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="text-xs text-green-600 font-medium">You Overridden ✓</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit override
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Override rating ▼
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-0 top-full z-30 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-950/5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Override assessment</div>
          <p className="mt-0.5 text-xs text-slate-500">Adjust the AI rating with human context.</p>
        </div>
        <Pencil className="h-4 w-4 text-slate-400" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Your rating:</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm">Notes (optional):</Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add context for your override..."
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive">Failed to save override. Please try again.</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
      </div>
    </div>
  );
}
