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
  DialogDescription
} from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import OverrideHistory from "./OverrideHistory";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, ShieldCheck, ArrowDownCircle } from "lucide-react";
import { m } from "@/paraglide/messages.js";
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
        assessor_notes: notes.trim()
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
          <ShieldCheck className="h-3.5 w-3.5 mr-1 text-verdict-match" />{" "}
          {m.override.override_applied()}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> {m.override.override_rating()}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasOverride ? m.override.edit_override() : m.override.dialog_title()}
            </DialogTitle>
            <DialogDescription>
              {hasOverride ? m.override.adjust_level() : m.override.select_level()}
            </DialogDescription>
          </DialogHeader>

          {hasOverride && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{m.override.current()}</span>
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">{m.override.your_rating()}</Label>
            <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${skill.id}`} className="text-sm">
              {m.override.reason()} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={m.override.explain()}
            />
          </div>

          {saveError && <p className="text-xs text-destructive">{m.override.failed_to_save()}</p>}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {m.override.cancel()}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {m.override.save()}
            </Button>
          </DialogFooter>

          <OverrideHistory portfolioSkillId={skill.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}
