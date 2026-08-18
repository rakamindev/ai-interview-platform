import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, ChevronDown, Check } from "lucide-react";
import { parseLevel, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

// ── Level tile selector ────────────────────────────────────────────────────
function LevelTile({
  level,
  selected,
  onClick,
}: {
  level: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border-2 transition-all text-center",
        selected
          ? "border-primary bg-primary/8 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
      )}
    >
      <span className="text-sm font-bold">
        {LEVEL_LABELS[level]}
      </span>
      <span className="text-[10px] leading-tight">
        {LEVEL_DESCRIPTIONS[level]}
      </span>
      {selected && (
        <Check className="h-3 w-3 mt-0.5" />
      )}
    </button>
  );
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? parseLevel(skill.ai_level)
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);

  const aiLevel = parseLevel(skill.ai_level);
  const hasOverride = !!existingOverride;
  const levelChanged = overrideLevel !== aiLevel;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    setSaved(false);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(res.data.override);
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 800);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to existing override values on cancel
    setOverrideLevel(existingOverride?.override_level ?? aiLevel);
    setNotes(existingOverride?.assessor_notes ?? "");
    setSaveError(false);
    setOpen(false);
  };

  return (
    <div className="mt-3 border-t pt-3">
      {/* ── Collapsed state ──────────────────────────────────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between group"
        >
          {hasOverride ? (
            // Show existing override summary
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">AI assessment:</span>
              <LevelBadge level={aiLevel} size="sm" />
              <span className="text-xs text-muted-foreground">→</span>
              <span className="text-xs font-medium text-foreground">Your override:</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              {existingOverride!.override_level !== aiLevel && (
                <span className={cn(
                  "text-[11px] font-semibold px-1.5 py-0.5 rounded",
                  existingOverride!.override_level > aiLevel
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  {existingOverride!.override_level > aiLevel ? "↑" : "↓"}{" "}
                  {Math.abs(existingOverride!.override_level - aiLevel)} level
                  {Math.abs(existingOverride!.override_level - aiLevel) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Disagree with the AI rating?
            </span>
          )}

          <span className="flex items-center gap-1 text-xs text-primary font-medium ml-auto shrink-0 group-hover:underline">
            <Pencil className="h-3 w-3" />
            {hasOverride ? "Edit override" : "Adjust rating"}
            <ChevronDown className="h-3.5 w-3.5 ml-0.5 transition-transform" />
          </span>
        </button>
      )}

      {/* ── Expanded form ────────────────────────────────────────────────── */}
      {open && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Adjust rating</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI assessed this skill at{" "}
                <span className="font-medium text-foreground">
                  {LEVEL_LABELS[aiLevel]} — {LEVEL_DESCRIPTIONS[aiLevel]}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Level tile grid */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Your assessment:
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <LevelTile
                  key={level}
                  level={level}
                  selected={overrideLevel === level}
                  onClick={() => setOverrideLevel(level)}
                />
              ))}
            </div>
            {levelChanged && (
              <p className={cn(
                "text-xs font-medium mt-2",
                overrideLevel > aiLevel ? "text-green-600" : "text-amber-600"
              )}>
                {overrideLevel > aiLevel ? "↑ Upgrading" : "↓ Downgrading"} from{" "}
                {LEVEL_LABELS[aiLevel]} to {LEVEL_LABELS[overrideLevel]}
              </p>
            )}
            {!levelChanged && (
              <p className="text-xs text-muted-foreground mt-2">
                Selecting the same level as AI will confirm the rating.
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`override-notes-${skill.id}`}>
              Assessor notes <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              id={`override-notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Why are you adjusting this rating? Visible to reviewers."
              className="text-sm resize-none"
            />
          </div>

          {/* Error */}
          {saveError && (
            <p className="text-xs text-destructive">
              Failed to save. Please try again.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || saved}
              className="flex-1"
            >
              {saved ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" />Saved</>
              ) : saving ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
              ) : (
                "Save override"
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
