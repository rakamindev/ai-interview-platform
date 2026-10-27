import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, X } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? parseLevel(skill.ai_level)
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;

  useEffect(() => {
    if (open) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(false);
    }
  }, [open, existingOverride, skill.ai_level]);

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

  return (
    <div className="flex items-center gap-2">
      {hasOverride && (
        <div className="flex items-center gap-1.5 text-sm">
          <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
          <span className="text-muted-foreground text-xs">AI</span>
          <span className="text-muted-foreground">→</span>
          <LevelBadge level={existingOverride.override_level} size="sm" />
          <span className="text-xs text-green-600 font-medium">You Overridden ✓</span>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {hasOverride ? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Edit override
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs font-medium border-slate-200 hover:bg-slate-50">
              Override rating ▼
            </Button>
          )}
        </PopoverTrigger>

        <PopoverContent align="end" className="w-80 sm:w-96 p-4 space-y-3.5 shadow-lg border-slate-200 bg-white">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Override Rating
              </h4>
              <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                {skill.skill_label}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-slate-700"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Your rating:</Label>
            <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${skill.id}`} className="text-xs font-semibold text-slate-700">
              Notes (optional):
            </Label>
            <Textarea
              id={`notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context for your override..."
              className="text-xs resize-none"
            />
          </div>

          {saveError && (
            <p className="text-xs text-destructive">Failed to save override. Please try again.</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save override
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
