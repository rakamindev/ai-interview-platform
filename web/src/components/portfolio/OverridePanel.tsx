import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const initialLevel = existingOverride?.override_level ?? (parseLevel(skill.ai_level) ?? 3);
  const [overrideLevel, setOverrideLevel] = useState<number>(initialLevel);
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
            <div className="flex items-center gap-1.5 text-xs">
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground text-[11px]">AI</span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold ml-1">Overridden ✓</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs rounded-xl"
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-muted text-xs rounded-xl shadow-sm"
          >
            Override Rating ▼
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-border/80 rounded-2xl p-4 space-y-3 bg-muted/40 shadow-sm transition-colors duration-200">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Sesuaikan Penilaian Asesor
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">Tingkat Level Rekomendasi:</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-xs font-medium text-foreground">
          Catatan Justifikasi (Opsional):
        </Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Berikan alasan atau konteks penyesuaian nilai..."
          className="bg-background border-border text-xs text-foreground placeholder:text-muted-foreground rounded-xl"
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive font-medium">Gagal menyimpan override. Silakan coba lagi.</p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground rounded-xl"
        >
          Batal
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-sm active:scale-95 transition-all"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Simpan Penilaian
        </Button>
      </div>
    </div>
  );
}
