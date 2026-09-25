import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, SlidersHorizontal, CheckCircle2 } from "lucide-react";
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

  const handleOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(false);
    }
  };

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
    <Dialog open={open} onOpenChange={handleOpen}>
      <div className="flex items-center gap-2 shrink-0">
        {hasOverride ? (
          <div className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">AI:</span>
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-0.5 ml-1">
                <CheckCircle2 className="h-3 w-3" /> Overridden
              </span>
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </DialogTrigger>
          </div>
        ) : (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-border/80 hover:border-[#01959F]/60 hover:text-[#01959F] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#01959F]" />
              Override rating
            </Button>
          </DialogTrigger>
        )}
      </div>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#01959F]" />
            Override Competency Rating
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Adjust the candidate&apos;s evaluated rating for{" "}
            <span className="font-semibold text-foreground">{skill.skill_label}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Baseline AI Reference */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
            <span className="text-muted-foreground">AI Evaluation Baseline:</span>
            <div className="flex items-center gap-1.5">
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="font-medium text-foreground">
                (Confidence: {skill.ai_confidence || "N/A"})
              </span>
            </div>
          </div>

          {/* New Level Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Your Assessor Rating:</Label>
            <div className="pt-1">
              <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
            </div>
          </div>

          {/* Assessor Notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${skill.id}`} className="text-xs font-semibold text-foreground">
              Override Notes &amp; Justification <span className="font-normal text-muted-foreground">(Optional)</span>:
            </Label>
            <Textarea
              id={`notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Provide reason or context for adjusting the candidate's rating..."
              className="text-xs resize-y"
            />
          </div>

          {saveError && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
              Failed to save override. Please try again.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs bg-[#01959F] hover:bg-[#017a82] text-white"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
