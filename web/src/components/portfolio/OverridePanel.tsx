import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import Notice from "@/components/Notice";
import { ChevronDown, Loader2, Pencil } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import { getApiErrorMessage } from "@/lib/apiError";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const aiLevel = parseLevel(skill.ai_level);
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState<number | null>(
    existingOverride?.override_level ?? aiLevel,
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasOverride = !!existingOverride;

  // Cancel discards the draft so reopening shows what is actually saved.
  const handleCancel = () => {
    setOverrideLevel(existingOverride?.override_level ?? aiLevel);
    setNotes(existingOverride?.assessor_notes ?? "");
    setSaveError(null);
    setOpen(false);
  };

  const handleSave = async () => {
    if (overrideLevel === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch (requestError: unknown) {
      setSaveError(getApiErrorMessage(requestError, "Failed to save override. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {hasOverride ? (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <LevelBadge level={aiLevel} size="sm" />
              <span className="text-muted-foreground text-xs">AI</span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                Overridden by you
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil /> Edit override
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Override rating <ChevronDown />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-2xl border bg-rakamin-light-cyan/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rakamin-teal">
        Override
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Your rating:</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm">
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

      {saveError && <Notice variant="error">{saveError}</Notice>}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || overrideLevel === null}>
          {saving && <Loader2 className="animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
  );
}
