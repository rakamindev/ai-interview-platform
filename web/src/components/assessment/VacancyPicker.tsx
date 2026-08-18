import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { vacanciesApi } from "@/services/vacancies";
import type { Vacancy, VacancySkill } from "@/types";

interface VacancyPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (vacancyId: number, skills: VacancySkill[]) => void;
  /** Skills fetched for previously selected vacancies, keyed by vacancy id. */
  fetchedSkills: Record<number, VacancySkill[]>;
  /** Skill labels currently in the assessment. */
  currentLabels: (string | undefined)[];
}

export default function VacancyPicker({
  open,
  onOpenChange,
  onSelect,
  fetchedSkills,
  currentLabels,
}: VacancyPickerProps) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies ?? []))
      .catch((err) => { console.error("vacancies fetch failed:", err); setVacancies([]); })
      .finally(() => setLoading(false));
  }, [open]);

  // A vacancy is fully added when every one of its skills is already in the assessment.
  const visible = vacancies.filter((v) => {
    const skills = fetchedSkills[v.id];
    if (!skills) return true;
    return !skills.every((s) => currentLabels.includes(s.skill_label));
  });

  const handleSelect = async (id: number) => {
    setBusyId(id);
    try {
      const res = await vacanciesApi.get(id);
      onSelect(id, res.data.vacancy.skills ?? []);
      onOpenChange(false);
    } catch (err) {
      console.error("vacancy fetch failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add from Vacancy</DialogTitle>
        </DialogHeader>

        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No vacancies found.</p>
          ) : (
            visible.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => handleSelect(v.id)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm flex items-center justify-between"
              >
                <span>{v.role_title}</span>
                {busyId === v.id && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
