import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SkillPicker from "@/components/assessment/SkillPicker";
import VacancySkillCard, { type VacancyFormValues } from "@/components/vacancy/VacancySkillCard";
import { vacanciesApi } from "@/services/vacancies";
import { AlertCircle, ArrowLeft, Plus, Loader2, Save } from "lucide-react";

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const removedSkillIds = useRef<Set<number>>(new Set());

  const form = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors, isDirty } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    vacanciesApi.get(Number(id)).then((res) => {
      const v = res.data.vacancy;
      removedSkillIds.current.clear();
      reset({ role_title: v.role_title, culture_dimensions: v.culture_dimensions, competency_expectations: v.competency_expectations, skills: v.skills });
    }).catch(() => setLoadError("Unable to load this vacancy. Please refresh or return to vacancies.")).finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  const removeSkill = (index: number) => {
    const skill = watch(`skills.${index}`);
    if (typeof skill?.id === "number") {
      removedSkillIds.current.add(skill.id);
    }
    remove(index);
  };

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: [
          ...data.skills,
          ...Array.from(removedSkillIds.current, (skillId) => ({
            id: skillId,
            _destroy: true,
          })),
        ],
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;
  if (loadError) return <div className="max-w-2xl mx-auto space-y-4" role="alert"><p className="text-sm text-destructive">{loadError}</p><Link to="/vacancies" className="text-sm text-primary hover:underline">Back to vacancies</Link></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <span className="text-sm font-medium">Edit Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label>Role title <span className="text-destructive">*</span></Label>
          <Input id="role_title" aria-invalid={!!errors.role_title} {...register("role_title", { required: true })} />
          {errors.role_title && <p className="text-xs text-destructive">Role title is required.</p>}
        </div>
        <Separator />
        <div className="space-y-3">
          <Label>Expected skills</Label>
          <p className="text-sm text-muted-foreground">Set the minimum proficiency required for this role. These levels are used by Fit/Gap analysis.</p>
          <div className="space-y-2">
            {fields.map((field, index) => <VacancySkillCard key={field.id} index={index} form={form} onRemove={() => removeSkill(index)} />)}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill
          </Button>
        </div>
        <Separator />
        <Card><CardHeader><CardTitle>Role context</CardTitle><CardDescription>These notes help generate the culture and competency narrative in Fit/Gap analysis.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-1.5"><Label htmlFor="culture_dimensions">Company culture</Label><Textarea id="culture_dimensions" rows={4} placeholder="Ownership-driven, async-first, direct feedback culture..." {...register("culture_dimensions")} /></div><div className="space-y-1.5"><Label htmlFor="competency_expectations">Competency expectations</Label><Textarea id="competency_expectations" rows={4} placeholder="Strong communicator who can align cross-functional teams..." {...register("competency_expectations")} /></div></CardContent></Card>
        {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground" aria-live="polite">{isDirty ? "Unsaved changes" : "All changes saved"}</p><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => { if (!isDirty || window.confirm("Discard your unsaved changes?")) navigate("/vacancies"); }}>Cancel</Button><Button type="submit" disabled={submitting || !isDirty}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes</Button></div></div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })} />
    </div>
  );
}
