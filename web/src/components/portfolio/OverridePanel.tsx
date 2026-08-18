import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { Loader2, Pencil } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";
import { useOverridePanel } from "./useOverridePanel";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const {
    open,
    setOpen,
    panelRef,
    overrideLevel,
    setOverrideLevel,
    notes,
    setNotes,
    saving,
    saveError,
    hasOverride,
    handleSave,
  } = useOverridePanel({ skill, existingOverride, onSaved });

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
      {hasOverride && (
        <div className="flex items-center gap-1.5 text-sm">
          <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
          <span className="text-muted-foreground text-xs">AI</span>
          <span className="text-muted-foreground">→</span>
          <LevelBadge level={existingOverride!.override_level} size="sm" />
          <span className="text-xs text-green-600 font-medium">You Overridden ✓</span>
        </div>
      )}

      <div className="relative">
        <Button variant={hasOverride ? "ghost" : "outline"} size="sm" onClick={() => setOpen(prev => !prev)}>
          {hasOverride ? (
            <><Pencil className="h-3 w-3 mr-1" /> Edit</>
          ) : (
            "Override rating ▼"
          )}
        </Button>

        {open && (
          <div
            ref={panelRef}
            className={`absolute z-50 w-80 ${hasOverride ? 'right-0' : 'left-0 sm:left-auto sm:right-0'} mt-2 p-4 space-y-4 bg-background border rounded-md shadow-lg`}
          >
            <div className="text-sm font-semibold">Override AI Rating</div>

            {saveError && (
              <div className="bg-destructive/15 p-3 rounded-md text-sm text-destructive">
                <p>{saveError}</p>
              </div>
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
                placeholder="Add context for your override..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="w-full">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save override
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
