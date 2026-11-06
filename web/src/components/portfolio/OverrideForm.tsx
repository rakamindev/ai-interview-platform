import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2 } from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
import { OVERRIDE_REASON_MAX, OVERRIDE_REASON_MIN, apiErrorMessage, isValidOverrideReason } from "@/utils/overrides";
import { cn } from "@/lib/utils";
import type { AssessorOverride, OverrideEvent, PortfolioSkill } from "@/types";

interface OverrideFormProps {
  skill: PortfolioSkill;
  /** Level yang berlaku saat ini (hasil koreksi terakhir, atau level AI). */
  currentLevel: number;
  onSaved: (override: AssessorOverride, event: OverrideEvent) => void;
  onCancel: () => void;
}

/**
 * Form koreksi level oleh asesor (F-04). Alasan wajib karena koreksi mengubah
 * hasil penilaian kandidat dan harus bisa dipertanggungjawabkan.
 */
export default function OverrideForm({ skill, currentLevel, onSaved, onCancel }: OverrideFormProps) {
  const uid = useId();
  const reasonId = `${uid}-reason`;
  const hintId = `${uid}-hint`;

  const [level, setLevel] = useState(currentLevel);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLength = reason.trim().length;
  const reasonValid = isValidOverrideReason(reason);
  const levelChanged = level !== currentLevel;
  const canSave = reasonValid && levelChanged && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portfoliosApi.saveOverride(skill.id, { override_level: level, assessor_notes: reason });
      onSaved(res.data.override, res.data.event);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30" aria-label={`Correct rating for ${skill.skill_label}`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correct AI rating</p>
        <p className="text-xs text-muted-foreground">
          Current level: <span className="font-medium text-foreground">{LEVEL_LABELS[currentLevel]}</span>. Every
          correction is recorded with your reason and cannot be edited later.
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">New level</legend>
        <LevelRadio value={level} onChange={setLevel} disabled={saving} idPrefix={`${uid}-level`} className="flex-wrap" />
        {!levelChanged && (
          <p className="text-xs text-muted-foreground">
            Choose a level different from the current level ({LEVEL_LABELS[currentLevel]}).
          </p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={reasonId} className="text-sm">
          Reason <span className="text-muted-foreground font-normal">(required)</span>
        </Label>
        <Textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          disabled={saving}
          aria-describedby={hintId}
          aria-invalid={reason.length > 0 && !reasonValid}
          placeholder="What in the transcript supports this level?"
          className="resize-y break-words"
        />
        <div id={hintId} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>At least {OVERRIDE_REASON_MIN} characters. The candidate's result depends on it.</span>
          <span className={cn("tabular-nums shrink-0", trimmedLength > OVERRIDE_REASON_MAX && "text-destructive font-medium")}>
            {trimmedLength}/{OVERRIDE_REASON_MAX}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save correction"
          )}
        </Button>
      </div>
    </div>
  );
}
