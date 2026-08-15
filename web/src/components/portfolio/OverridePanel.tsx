import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  // Falls back to L3 (mid-scale) only as the *form's* starting position when
  // there is nothing to correct. It is never persisted unless the assessor
  // submits, so it cannot become a rating by default.
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? skill.ai_level ?? 3,
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasOverride = !!existingOverride;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    setSaveMessage(null);
    try {
      const res = await portfoliosApi.saveOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch (e) {
      // Was a bare `catch {}`, so an assessor saw a generic failure with no
      // indication of what went wrong or whether a retry would help.
      setSaveError(true);
      setSaveMessage(e instanceof Error ? e.message : "Could not save the override.");
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
              {skill.ai_level != null ? (
                <>
                  <LevelBadge level={skill.ai_level} size="sm" />
                  <span className="text-muted-foreground text-xs">AI</span>
                </>
              ) : (
                <span className="text-muted-foreground text-xs">Not assessed</span>
              )}
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
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Override
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
        <p role="alert" className="text-xs text-destructive">
          {saveMessage ?? "Failed to save override. Please try again."}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
  );
}
