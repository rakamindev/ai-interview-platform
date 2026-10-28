
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Check, Loader2, Pencil } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({
  skill,
  existingOverride,
  onSaved,
}: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? parseLevel(skill.ai_level),
  );
  const [notes, setNotes] = useState(
    existingOverride?.assessor_notes ?? "",
  );
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
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {hasOverride ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">AI</span>
                <LevelBadge
                  level={parseLevel(skill.ai_level)}
                  size="sm"
                />
                <span className="mx-0.5 text-muted-foreground">→</span>
                <LevelBadge
                  level={existingOverride!.override_level}
                  size="sm"
                />
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Overridden
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              AI-assessed rating
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          {hasOverride ? "Edit rating" : "Override rating"}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">Override assessment</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Set your rating and optionally explain your decision.
          </p>
        </div>

        {hasOverride && (
          <span className="shrink-0 rounded-full border px-2 py-1 text-xs text-muted-foreground">
            Editing
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <Label className="text-sm">Your rating</Label>

        <div className="w-full min-w-0">
          <LevelRadio
            value={overrideLevel}
            onChange={setOverrideLevel}
          />
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm">
          Assessor notes{" "}
          <span className="font-normal text-muted-foreground">
            (optional)
          </span>
        </Label>

        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full resize-y text-sm"
          placeholder="Explain the reason for your rating..."
        />
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          Failed to save your rating. Please try again.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            setOpen(false);
            setSaveError(false);
          }}
          disabled={saving}
        >
          Cancel
        </Button>

        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Save rating
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
