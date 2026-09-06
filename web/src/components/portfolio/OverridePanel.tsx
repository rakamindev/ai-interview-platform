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
  const [overrideLevel, setOverrideLevel] = useState(existingOverride?.override_level ?? parseLevel(skill.ai_level));
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  /**
   * Satu-satunya syarat untuk menyimpan: ada level yang benar-benar dipilih.
   *
   * `overrideLevel` bertipe `number | null` sejak parseLevel (utils/constants.ts)
   * berhenti mengarang L1 untuk data yang tidak dikenalnya. `null` di sini punya
   * arti yang tepat: belum ada manusia yang memilih. Baris override, menurut
   * definisinya, adalah penilaian manusia yang menimpa penilaian AI — kolomnya
   * `override_level` dan tetangganya `overridden_by` (schema.rb). Menyimpannya
   * tanpa pilihan berarti menulis kesaksian atas nama assessor yang tidak
   * pernah bersaksi, dan kesaksian itu ikut ke laporan fit/gap serta PDF ekspor.
   */
  const canSave = overrideLevel != null;

  const handleSave = async () => {
    /**
     * Dijaga di dalam handler, bukan hanya di atribut `disabled` tombol.
     * `disabled` adalah presentasi, dan presentasi bisa dilanggar — autofill,
     * ekstensi peramban, refactor tombol, atau pemanggil baru yang belum ada.
     * Invarian ini menyangkut apa yang tersimpan permanen, jadi tempatnya di
     * jalur yang menyimpan.
     *
     * Sekaligus inilah yang menyempitkan `number | null` → `number`, sehingga
     * payload di bawah memenuhi kontrak services/portfolios.ts:5 tanpa cast.
     * Kontrak itu tidak dilonggarkan: `override_level: number` memang benar.
     */
    if (overrideLevel == null) return;

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
        {existingOverride ? (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground text-xs">AI</span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride.override_level} size="sm" />
              <span className="text-xs text-green-600 font-medium">You Overridden ✓</span>
            </div>
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
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Override
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Your rating:</Label>
        <LevelRadio label={skill.skill_label} value={overrideLevel} onChange={setOverrideLevel} />
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

      {/*
        Tombol mati tanpa penjelasan adalah cacat tersendiri: assessor
        menyimpulkan aplikasinya rusak, lalu berhenti memakai fitur ini — dan
        penilaian manusia yang seharusnya masuk tidak pernah masuk. Kalimat ini
        menyebut penyebabnya (AI tidak memberi level yang bisa dipakai) dan
        tindakannya (pilih sendiri), bukan sekadar melarang.
      */}
      {!canSave && (
        <p className="text-xs text-muted-foreground">
          Choose a level to save. The AI did not provide a usable rating for this skill, so there is
          nothing to adjust — your override starts from scratch.
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
  );
}
