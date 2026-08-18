import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { parseLevel } from "@/utils/constants";
import type { AssessorOverride, PortfolioSkill } from "@/types";
import LevelBadge from "./LevelBadge";

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
  const hasOverride = Boolean(existingOverride);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const response = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(response.data.override);
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
        {hasOverride && existingOverride ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {skill.rating_status === "not_assessed" ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">AI: not assessed</span>
            ) : (
              <>
                <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
                <span className="text-xs text-slate-500">AI</span>
              </>
            )}
            <span className="text-slate-400" aria-hidden="true">→</span>
            <LevelBadge level={existingOverride.override_level} size="sm" />
            <span className="text-xs font-medium text-emerald-700">Human override</span>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Override rating
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 sm:min-w-[320px] sm:max-w-md">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Override rating</div>
      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Your rating</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm text-slate-700">Notes (optional)</Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Add context for the human decision..."
        />
        <div className="text-right text-xs text-slate-500">{notes.length}/2000</div>
      </div>
      {saveError && <p role="alert" className="text-xs text-rose-700">Failed to save override. Please try again.</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save override
        </Button>
      </div>
    </div>
  );
}
