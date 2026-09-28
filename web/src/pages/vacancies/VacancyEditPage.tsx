import { notify } from "@/components/ui/toast";
import { useBreadcrumbLabel } from "@/components/layout/Breadcrumbs";
import { PageHeader, ErrorState } from "@/components/ui/page";
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
  const [recordTitle, setRecordTitle] = useState("");
  useBreadcrumbLabel(`vacancies:${id}`, recordTitle);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    vacanciesApi.get(Number(id)).then((res) => {
      const v = res.data.vacancy;
      setRecordTitle(v.role_title);
      reset({ role_title: v.role_title, culture_dimensions: v.culture_dimensions, competency_expectations: v.competency_expectations, skills: v.skills });
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      notify("Vacancy saved.");
      navigate("/vacancies");
    } catch {
      notify("Could not save. Your changes are still here; please try again.", "error");
      setError("Could not save the vacancy. Your changes are still here; please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;

  if (loadError) return <ErrorState message="Could not load the saved settings." onRetry={() => window.location.reload()} />;

  return (
    <div className="form-page">
      <Link to="/vacancies" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All vacancies</Link>

      <PageHeader title={recordTitle || "Edit vacancy"} description="Edit vacancy requirements. These expectations are used when comparing candidate portfolios." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="role_title">Role title <span className="text-destructive">*</span></Label>
          <Input id="role_title" aria-invalid={!!errors.role_title} aria-describedby={errors.role_title ? "role-error" : undefined} {...register("role_title", { required: "Role title is required" })} />
          {errors.role_title && <p id="role-error" role="alert" className="text-xs text-destructive">{errors.role_title.message}</p>}
        </div>
        <Separator />
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Expected skills</h2>
            <p className="mt-1 text-sm text-muted-foreground">Define the target level for each skill required by this role.</p>
          </div>
          {!fields.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No skill expectations yet. Add a skill to define how candidates will be compared.</p>}
          {fields.map((field, index) => (
            <div key={field.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${watch(`skills.${index}.skill_label`)} expectation`} onClick={() => remove(index)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"><X /></Button>
              </div>
              <LevelRadio value={watch(`skills.${index}.expected_level`) ?? 3} onChange={(v) => setValue(`skills.${index}.expected_level`, v)} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill
          </Button>
        </div>
        <Separator />
        <div>
          <h2 className="text-base font-semibold">Evaluation context</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add the working environment and competencies to consider alongside skill evidence.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions">Company culture</Label>
          <Textarea id="culture_dimensions" rows={3} {...register("culture_dimensions")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">Competency expectations</Label>
          <Textarea id="competency_expectations" rows={3} {...register("competency_expectations")} />
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })} />
    </div>
  );
}
