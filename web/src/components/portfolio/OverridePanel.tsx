import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import OverrideHistory from "./OverrideHistory";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, ShieldCheck, ArrowDownCircle } from "lucide-react";
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
    existingOverride?.override_level ?? parseLevel(skill.ai_level),
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;
  const canSave = notes.trim().length > 0 && !saving;

  const handleOpen = () => {
    setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
    setNotes(existingOverride?.assessor_notes ?? "");
    setSaveError(false);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
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
    <>
      {hasOverride ? (
        <Button variant="ghost" size="sm" onClick={handleOpen}>
          <ShieldCheck className="h-3.5 w-3.5 mr-1 text-verdict-match" /> Override applied
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> Override rating
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{hasOverride ? "Edit override" : "Override rating"}</DialogTitle>
            <DialogDescription>
              {hasOverride
                ? "Adjust the level and update your reasoning."
                : "Select a level and explain your reasoning. This replaces the AI rating for this skill."}
            </DialogDescription>
          </DialogHeader>

          {hasOverride && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current:</span>
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">Your rating</Label>
            <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${skill.id}`} className="text-sm">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Explain why you are overriding the AI rating…"
            />
          </div>

          {saveError && (
            <p className="text-xs text-destructive">Failed to save override. Please try again.</p>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save override
            </Button>
          </DialogFooter>

          <OverrideHistory portfolioSkillId={skill.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}
