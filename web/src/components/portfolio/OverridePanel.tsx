import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, ShieldCheck, AlertCircle } from "lucide-react";
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
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasOverride = !!existingOverride;

  const handleSave = async () => {
    if (!notes.trim()) {
      setSaveError("Assessor justification note is mandatory for compliance and audit trail.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to save override. Please try again.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {hasOverride ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-xs">
                <span className="text-slate-500 font-medium">AI:</span>
                <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
                <span className="text-slate-400">→</span>
                <span className="text-slate-500 font-medium">Human:</span>
                <LevelBadge level={existingOverride!.override_level} size="sm" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
            {existingOverride?.assessor_notes && (
              <p className="text-[11px] text-slate-500 max-w-xs text-right truncate">
                Note: "{existingOverride.assessor_notes}"
              </p>
            )}
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={() => setOpen(true)}>
            <Pencil className="h-3 w-3 mr-1.5 text-slate-500" />
            Override rating
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3.5 bg-slate-50/80 text-left w-full mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Human Assessor Override
        </div>
        <span className="text-[11px] text-slate-500">Audit Trail Protected</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">Adjust Proficiency Level:</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`notes-${skill.id}`} className="text-xs font-medium text-slate-700">
            Justification & Evidence Notes <span className="text-red-500">*</span>
          </Label>
          <span className="text-[11px] text-slate-400">Mandatory</span>
        </div>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            if (saveError) setSaveError(null);
          }}
          rows={3}
          className="bg-white text-xs resize-none"
          placeholder="Document the technical rationale and transcript evidence supporting this adjustment..."
        />
      </div>

      {saveError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Confirm Override
        </Button>
      </div>
    </div>
  );
}
