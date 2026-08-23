import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import LevelRadio from "@/shared/components/LevelRadio";
import SkillPicker from "@/shared/components/SkillPicker";
import DeleteConfirmDialog from "@/shared/components/DeleteConfirmDialog";
import { vacanciesApi } from "@/features/vacancies/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, Trash2 } from "lucide-react";
import type { VacancySkill } from "@/features/vacancies/types";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Skill ids that existed on the server when this page loaded — used to tell
  // Rails' nested attributes which ones to _destroy when they're removed from
  // the list (simply omitting them from the payload does NOT delete them).
  const [originalSkillIds, setOriginalSkillIds] = useState<number[]>([]);

  const { register, handleSubmit, control, setValue, watch, reset } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    vacanciesApi.get(Number(id)).then((res) => {
      const v = res.data.vacancy;
      reset({ role_title: v.role_title, culture_dimensions: v.culture_dimensions, competency_expectations: v.competency_expectations, skills: v.skills });
      setOriginalSkillIds((v.skills ?? []).map((s) => s.id).filter((val): val is number => val != null));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setSubmitting(true);
    try {
      const remainingIds = new Set(data.skills.map((s) => s.id).filter((v): v is number => v != null));
      const destroyedSkills = originalSkillIds
        .filter((skillId) => !remainingIds.has(skillId))
        .map((skillId) => ({ id: skillId, _destroy: true }));

      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: [...data.skills, ...destroyedSkills],
      });
      navigate("/vacancies");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await vacanciesApi.delete(Number(id));
      navigate("/vacancies");
    } catch (e: any) {
      setDeleteError(e?.response?.data?.errors?.[0]?.message ?? "Failed to delete.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <span className="text-sm font-medium">Edit Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label>Role title <span className="text-destructive">*</span></Label>
          <Input {...register("role_title", { required: true })} />
        </div>
        <Separator />
        <div className="space-y-3">
          <Label>Expected skills</Label>
          {fields.map((field, index) => (
            <div key={field.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
              <LevelRadio value={watch(`skills.${index}.expected_level`) ?? 3} onChange={(v) => setValue(`skills.${index}.expected_level`, v)} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill
          </Button>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <Label>Company culture</Label>
          <Textarea rows={3} {...register("culture_dimensions")} />
        </div>
        <div className="space-y-1.5">
          <Label>Competency expectations</Label>
          <Textarea rows={3} {...register("competency_expectations")} />
        </div>
        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
        <div className="flex items-center justify-between">
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
          </div>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
        excludeLabels={fields.map((f) => f.skill_label?.toLowerCase()).filter(Boolean) as string[]}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this vacancy?"
        description="This can't be undone. Fit-gap reports tied to it will be removed too."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
