import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import type { VacancySkill } from "@/types";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { register, handleSubmit, control, setValue, watch, reset } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        const v = res.data?.vacancy;
        if (v) {
          reset({
            role_title: v.role_title,
            culture_dimensions: v.culture_dimensions,
            competency_expectations: v.competency_expectations,
            skills: v.skills,
          });
        } else {
          setLoadError("Vacancy not found or has been deleted.");
        }
      })
      .catch((err) => {
        setLoadError(err?.response?.status === 404 ? "Vacancy not found or has been deleted." : "Failed to load vacancy.");
      })
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/vacancies" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium">Edit Vacancy</span>
        </div>
        <div className="border rounded-lg p-8 text-center space-y-4 bg-muted/20">
          <p className="font-medium text-foreground">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/vacancies")}>
            Back to Vacancies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })} />
    </div>
  );
}
