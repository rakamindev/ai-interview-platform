import { useCallback, useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import ApiErrorList from "@/components/ApiErrorList";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, Trash2 } from "lucide-react";
import type { VacancySkill, VacancyStatus } from "@/types";
import { apiErrorMessages } from "@/utils/apiErrors";

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
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedStatus, setSavedStatus] = useState<VacancyStatus>("active");
  const [pendingStatus, setPendingStatus] = useState<VacancyStatus>("active");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusErrors, setStatusErrors] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const loadVacancy = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    vacanciesApi.get(Number(id)).then((res) => {
      const v = res.data.vacancy;
      reset({ role_title: v.role_title, culture_dimensions: v.culture_dimensions, competency_expectations: v.competency_expectations, skills: v.skills });
      setSavedStatus(v.status);
      setPendingStatus(v.status);
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => loadVacancy(), [loadVacancy]);

  const onSubmit = async (data: VacancyFormValues) => {
    setServerErrors([]);
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setServerErrors(apiErrorMessages(e, "Failed to save vacancy."));
    } finally {
      setSubmitting(false);
    }
  };

  const saveStatus = async () => {
    if (pendingStatus === savedStatus) return;
    setStatusErrors([]);
    setSavingStatus(true);
    try {
      await vacanciesApi.updateStatus(Number(id), pendingStatus);
      setSavedStatus(pendingStatus);
    } catch (e: any) {
      setStatusErrors(apiErrorMessages(e, "Could not update vacancy status."));
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading || loadError) return (
    <div className="mx-auto max-w-3xl space-y-4">
      {loadError ? (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-white p-5">
          <div>
            <h1 className="font-semibold">Vacancy could not be loaded</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your changes have not been saved. Try loading it again.</p>
          </div>
          <Button variant="outline" onClick={loadVacancy}>Try again</Button>
          <Button asChild variant="ghost"><Link to="/vacancies">Back to vacancies</Link></Button>
        </div>
      ) : <><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></>}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="flex items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Vacancies</Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Edit vacancy</h1>
          <p className="text-sm text-muted-foreground">Update the role requirements used in candidate fit analysis.</p>
        </div>
        <ConfirmActionDialog
          trigger={<Button type="button" variant="ghost" className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 /> Delete</Button>}
          title="Delete this vacancy?"
          description="It will be removed from active vacancies. Historical fit-gap reports remain saved."
          actionLabel="Delete vacancy"
          errorMessage="Could not delete vacancy. Try again."
          onConfirm={async () => {
            await vacanciesApi.delete(Number(id));
            navigate("/vacancies");
          }}
        />
      </div>

      <div className="mb-7 space-y-3 rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label htmlFor="vacancy-status">Vacancy status</Label>
            <Select value={pendingStatus} onValueChange={(value) => setPendingStatus(value as VacancyStatus)}>
              <SelectTrigger id="vacancy-status" className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={saveStatus} disabled={savingStatus || pendingStatus === savedStatus}>
            {savingStatus && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save status
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Only active vacancies appear in new Fit/Gap assessments. Closed vacancies stay available here for historical reports.</p>
        <ApiErrorList errors={statusErrors} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
        <div className="space-y-1.5">
          <Label htmlFor="role-title">Role title <span className="text-destructive">*</span></Label>
          <Input id="role-title" aria-invalid={!!errors.role_title} aria-describedby={errors.role_title ? "role-title-error" : undefined} {...register("role_title", { required: "Role title is required" })} />
          {errors.role_title && <p id="role-title-error" className="text-sm text-destructive">{errors.role_title.message}</p>}
        </div>
        <ApiErrorList errors={serverErrors} />
        <Separator />
        <div className="space-y-3">
          <div>
            <Label>Expected skills</Label>
            <p className="mt-1 text-sm text-muted-foreground">Choose a skill and set the level expected for this role.</p>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                <button type="button" aria-label={`Remove ${watch(`skills.${index}.skill_label`)}`} onClick={() => remove(index)} className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"><X className="h-4 w-4" /></button>
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
          <Label htmlFor="culture_dimensions">Company culture</Label>
          <Textarea id="culture_dimensions" rows={3} {...register("culture_dimensions")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">Competency expectations</Label>
          <Textarea id="competency_expectations" rows={3} {...register("competency_expectations")} />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save changes</Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })} />
    </div>
  );
}
