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
  const defaultLevel =
    existingOverride?.override_level ??
    (skill.ai_level != null ? parseLevel(skill.ai_level) : 3);

  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(defaultLevel);
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;
  const isNotAssessed = skill.assessment_status === "not_assessed";

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
              {skill.ai_level != null && (
                <>
                  <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
                  <span className="text-muted-foreground text-xs">AI</span>
                  <span className="text-muted-foreground">→</span>
                </>
              )}
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="text-xs text-green-700 font-medium">Your rating</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {isNotAssessed ? "Assign rating" : "Override rating"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30 min-w-[200px]">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isNotAssessed ? "Assessor rating" : "Override"}
      </div>

      {isNotAssessed && (
        <p className="text-xs text-muted-foreground">
          Skill was not assessed by AI. Your rating will be used for fit/gap.
        </p>
      )}

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
          placeholder="Add context for your rating..."
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive">Failed to save. Please try again.</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
