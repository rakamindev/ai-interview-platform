import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil } from "lucide-react";
import { parseOptionalLevel, LEVEL_LABELS } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const parsedAiLevel = parseOptionalLevel(skill.ai_level);
  const isNotAssessed = skill.assessment_status === "not_assessed" || parsedAiLevel == null;

  const [overrideLevel, setOverrideLevel] = useState<number>(
    existingOverride?.override_level ?? parsedAiLevel ?? 3
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasOverride = !!existingOverride;

  const handleSave = async () => {
    if (!notes.trim()) {
      setErrorMessage("Catatan assessor wajib diisi (tidak boleh kosong).");
      return;
    }
    if (notes.length > 2000) {
      setErrorMessage("Catatan assessor maksimal 2.000 karakter.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch (err: unknown) {
      let apiMsg = "Gagal menyimpan override. Silakan periksa koneksi dan coba lagi.";
      if (err && typeof err === "object" && "response" in err) {
        const resp = err.response;
        if (resp && typeof resp === "object" && "data" in resp) {
          const data = resp.data;
          if (data && typeof data === "object") {
            if ("errors" in data && Array.isArray(data.errors) && data.errors.length > 0) {
              const first = data.errors[0];
              if (first && typeof first === "object" && "message" in first && typeof first.message === "string") {
                apiMsg = first.message;
              }
            } else if ("error" in data && typeof data.error === "string") {
              apiMsg = data.error;
            } else if ("message" in data && typeof data.message === "string") {
              apiMsg = data.message;
            }
          }
        }
      }
      setErrorMessage(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {hasOverride ? (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground font-medium">
                {parsedAiLevel != null ? `AI: ${LEVEL_LABELS[parsedAiLevel]}` : "AI: Belum dinilai"}
              </span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="text-xs text-green-700 font-medium">Override ✓</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit override
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {isNotAssessed ? "Beri nilai manual" : "Override rating ▼"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isNotAssessed ? "Penilaian Manual Assessor" : "Override Nilai AI"}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Level</Label>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs">
          Catatan Assessor <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Jelaskan alasan penetapan atau pengubahan level ini berdasarkan bukti..."
          rows={3}
          maxLength={2000}
        />
        <p className="text-[11px] text-muted-foreground">
          {notes.length}/2000 karakter. Wajib diisi sebagai jejak keputusan.
        </p>
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Simpan
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          Batal
        </Button>
      </div>
    </div>
  );
}
