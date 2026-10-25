import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, UserCheck } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride | null) => void;
}

interface OverrideStatusProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
}

export function OverrideStatus({ skill, existingOverride }: OverrideStatusProps) {
  if (!existingOverride) return null;

  const aiLevel = parseLevel(skill.ai_level);
  if (existingOverride.override_level === aiLevel) return null;

  return (
    <Badge
      variant="outline"
      title={`This rating was changed by an assessor from AI L${aiLevel}`}
      className="mt-1 gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
    >
      <UserCheck className="h-3 w-3" aria-hidden="true" />
      Assessor adjusted · AI suggested L{aiLevel}
    </Badge>
  );
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(existingOverride?.override_level ?? parseLevel(skill.ai_level));
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;

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
    <div className="relative">
      <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] border rounded-lg p-4 space-y-3 bg-background shadow-lg">
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
          <p className="text-xs text-destructive">Failed to save override. Please try again.</p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save override
          </Button>
        </div>
      </div>
    </div>
  );
}
