import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { isAssessed, toLevel } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import { Loader2, PenLine, UserCheck } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

const NOTES_LIMIT = 2000;

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

/** Lets the assessor replace (or, for unassessed skills, supply) the rating. */
export function OverrideTrigger({
  skill,
  existingOverride,
  open,
  onToggle,
}: Pick<OverridePanelProps, "skill" | "existingOverride"> & { open: boolean; onToggle: () => void }) {
  const assessed = isAssessed(skill);
  const label = existingOverride ? "Edit your rating" : assessed ? "Adjust rating" : "Add your rating";

  return (
    <Button
      variant={assessed || existingOverride ? "outline" : "default"}
      size="sm"
      onClick={onToggle}
      aria-expanded={open}
      className="shrink-0"
    >
      <PenLine className="h-3.5 w-3.5 mr-1.5" aria-hidden />
      {label}
    </Button>
  );
}

export function OverrideSummary({ skill, override }: { skill: PortfolioSkill; override: AssessorOverride }) {
  const aiLevel = toLevel(skill.ai_level);
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-foreground">
          Rated L{override.override_level} by an assessor
          <span className="font-normal text-muted-foreground">
            {aiLevel ? ` · AI suggested L${aiLevel}` : " · AI did not rate this skill"}
          </span>
        </p>
        {override.assessor_notes && (
          <p className="whitespace-pre-wrap break-words text-muted-foreground">{override.assessor_notes}</p>
        )}
      </div>
    </div>
  );
}

export default function OverridePanel({ skill, existingOverride, onSaved, onCancel }: OverridePanelProps & { onCancel: () => void }) {
  const assessed = isAssessed(skill);
  const [level, setLevel] = useState<number>(existingOverride?.override_level ?? toLevel(skill.ai_level) ?? 3);
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesRequired = !assessed;
  const notesMissing = notesRequired && notes.trim().length === 0;
  const tooLong = notes.length > NOTES_LIMIT;

  const handleSave = async () => {
    if (notesMissing || tooLong) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portfoliosApi.saveOverride(skill.id, { override_level: level, assessor_notes: notes.trim() });
      onSaved(res.data.override);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Couldn't save your rating. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4 animate-in fade-in-0 slide-in-from-top-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Your rating</Label>
        <LevelRadio value={level} onChange={setLevel} idPrefix={`override-${skill.id}`} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`notes-${skill.id}`} className="text-sm">
            {notesRequired ? "What is this rating based on?" : "Note (optional)"}
          </Label>
          <span className={cn("text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
            {notes.length}/{NOTES_LIMIT}
          </span>
        </div>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          aria-invalid={notesMissing || tooLong}
          placeholder={
            notesRequired
              ? "e.g. Covered in a 20-minute follow-up call on 12 Aug — designed a rate limiter end to end."
              : "Why you disagree with the AI rating"
          }
        />
        {notesRequired && (
          <p className="text-xs text-muted-foreground">
            The AI had no evidence for this skill, so a note is required to record where your rating comes from.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || notesMissing || tooLong}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />}
          Save rating
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
