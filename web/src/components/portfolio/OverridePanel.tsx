import { useState, useEffect } from "react";
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
import ConfidenceIndicator from "./ConfidenceIndicator";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, SlidersHorizontal, AlertCircle, UserCheck } from "lucide-react";
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
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronize values when modal is opened or existingOverride updates
  useEffect(() => {
    if (open) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(null);
    }
  }, [open, existingOverride, skill.ai_level]);

  const hasOverride = !!existingOverride;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch (err: any) {
      setSaveError(
        err?.response?.data?.errors?.[0]?.message ||
          "Gagal menyimpan override. Silakan periksa koneksi dan coba lagi."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {hasOverride ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs gap-1.5 transition-colors shrink-0"
          >
            <Pencil className="h-3.5 w-3.5 text-[#01959f]" />
            <span>Edit override</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:text-[#01959f] hover:border-[#01959f]/40 border-slate-200 rounded-lg shadow-2xs gap-1.5 transition-colors shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>Override rating</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl mx-auto p-0 overflow-hidden rounded-2xl gap-0 border-slate-200 shadow-xl">
        <DialogHeader className="p-5 pb-4 bg-slate-50/70 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#01959f] uppercase tracking-wider mb-1">
            <UserCheck className="h-4 w-4" />
            <span>Human Assessor Override</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 leading-snug">
            {skill.skill_label}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Sesuaikan tingkat capaian kompetensi kandidat dan tambahkan catatan penilaian jika diperlukan.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* AI Baseline Context Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Penilaian Otomatis AI
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Level {parseLevel(skill.ai_level)}
                </span>
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              </div>
            </div>
            <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
          </div>

          {/* Level Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Your rating:
            </Label>
            <LevelRadio
              name={`modal-override-${skill.id}`}
              value={overrideLevel}
              onChange={setOverrideLevel}
            />
          </div>

          {/* Assessor Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor={`modal-notes-${skill.id}`}
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Catatan Penilai (Notes)
              </Label>
              <span className="text-[11px] text-slate-400">Audit trail &amp; laporan PDF</span>
            </div>
            <Textarea
              id={`modal-notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context for your override (Berikan alasan atau observasi spesifik)..."
              className="text-xs sm:text-sm rounded-xl border-slate-200 resize-none focus-visible:ring-[#01959f]"
            />
          </div>

          {saveError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 px-5 bg-slate-50/70 border-t border-slate-100 flex flex-row items-center justify-center sm:justify-end gap-2.5 sm:space-x-0 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="flex-1 sm:flex-initial rounded-xl text-xs h-9 px-4 font-semibold justify-center"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-initial rounded-xl text-xs h-9 px-4 bg-[#01959f] hover:bg-[#01959f]/90 text-white font-semibold shadow-xs justify-center"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Save override"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
