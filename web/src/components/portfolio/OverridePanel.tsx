import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, SlidersHorizontal, UserCheck, Sparkles, Check } from "lucide-react";
import { parseLevel, LEVEL_LABELS } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill & { ai_level: number };
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? parseLevel(skill.ai_level) ?? 1
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;

  const handleOpen = () => {
    setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level) ?? 1);
    setNotes(existingOverride?.assessor_notes ?? "");
    setSaveError(false);
    setOpen(true);
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
    <>
      {/* Trigger Button */}
      {hasOverride ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="h-8 px-2.5 text-xs font-semibold rounded-xl border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 hover:text-indigo-900 transition-colors shadow-2xs"
        >
          <Pencil className="h-3 w-3 mr-1.5 text-indigo-600" />
          <span>Edit Override</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="h-8 px-2.5 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
        >
          <SlidersHorizontal className="h-3 w-3 mr-1.5 text-slate-500" />
          <span>Override Rating</span>
        </Button>
      )}

      {/* Modern Dialog Popup Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white shadow-2xl border border-slate-200">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <UserCheck className="h-4 w-4" />
              <span>Penyesuaian Nilai Manual</span>
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Override Nilai: {skill.skill_label}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ubah skor level kompetensi jika bukti jawaban kandidat memerlukan penilaian khusus dari Assessor.
            </DialogDescription>
          </DialogHeader>

          {/* AI vs Human Baseline Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">Penilaian Asli AI</span>
              <div className="flex items-center gap-2 mt-1">
                <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
                <span className="text-xs font-bold text-slate-800">
                  {LEVEL_LABELS[parseLevel(skill.ai_level) || 1]}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-500 block">Keyakinan AI</span>
              <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mt-1">
                {skill.ai_confidence}
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Level Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-900">
                Pilih Level Baru (*Assessor Rating*):
              </Label>
              <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
            </div>

            {/* Assessor Notes */}
            <div className="space-y-1.5">
              <Label htmlFor={`notes-${skill.id}`} className="text-xs font-bold text-slate-900">
                Alasan &amp; Catatan Penyesuaian (*Audit Trail*):
              </Label>
              <Textarea
                id={`notes-${skill.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contoh: Kandidat menjelaskan teknik arsitektur modular pada menit ke-10 dengan sangat baik..."
                className="text-xs rounded-xl border-slate-200 focus:ring-primary focus:border-primary resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Catatan ini akan dicatat dalam riwayat audit dan tercetak pada laporan PDF resmi.
              </p>
            </div>

            {saveError && (
              <p className="text-xs font-semibold text-destructive bg-destructive/10 p-2 rounded-lg">
                Gagal menyimpan override. Silakan coba lagi.
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
