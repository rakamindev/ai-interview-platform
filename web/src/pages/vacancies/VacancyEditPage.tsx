import { useCallback, useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import SkillPicker from "@/components/assessment/SkillPicker";
import VacancySkillItem from "@/components/vacancies/VacancySkillItem";
import ApiErrorList from "@/components/ApiErrorList";
import { useToast } from "@/components/ui/toast";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
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
  const toast = useToast();
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
      toast.success("Vacancy updated.");
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
      toast.success("Vacancy status updated.");
    } catch (e: any) {
      setStatusErrors(apiErrorMessages(e, "Could not update vacancy status."));
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading || loadError) return (
    <div className="mx-auto max-w-4xl space-y-6">
      {loadError ? (
        <div role="alert" className="space-y-4 rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
          <div>
            <h1 className="font-semibold">Vacancy could not be loaded</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your changes have not been saved. Try loading it again.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={loadVacancy}>Try again</Button>
            <Button asChild variant="ghost"><Link to="/vacancies">Back to vacancies</Link></Button>
          </div>
        </div>
      ) : <><Skeleton className="h-8 w-40" /><Skeleton className="h-12 w-72 max-w-full" /><Skeleton className="h-48 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></>}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/vacancies" className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ArrowLeft className="h-4 w-4" />Vacancies
      </Link>

      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Edit vacancy</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Update the role requirements used in candidate fit analysis.</p>
        </div>
        <ConfirmActionDialog
          trigger={<Button type="button" variant="outline" className="w-full shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"><Trash2 /> Delete vacancy</Button>}
          title="Delete this vacancy?"
          description="It will be removed from active vacancies. Historical fit-gap reports remain saved."
          actionLabel="Delete vacancy"
          errorMessage="Could not delete vacancy. Try again."
          successMessage="Vacancy deleted."
          onConfirm={async () => {
            await vacanciesApi.delete(Number(id));
            navigate("/vacancies");
          }}
        />
      </div>

      <section aria-labelledby="vacancy-status-heading" className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h2 id="vacancy-status-heading" className="font-semibold">Vacancy status</h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">Only active vacancies appear in new Fit/Gap assessments. Closed vacancies stay available for historical reports.</p>
            <Label className="sr-only" htmlFor="vacancy-status">Status</Label>
            <Select value={pendingStatus} onValueChange={(value) => setPendingStatus(value as VacancyStatus)}>
              <SelectTrigger id="vacancy-status" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={saveStatus} disabled={savingStatus || pendingStatus === savedStatus}>
            {savingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingStatus ? "Saving status..." : "Save status"}
          </Button>
        </div>
        <ApiErrorList errors={statusErrors} />
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="overflow-hidden rounded-xl border bg-card">
        <section aria-labelledby="vacancy-role-heading" className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 id="vacancy-role-heading" className="font-semibold">Role details</h2>
            <p className="mt-1 text-sm text-muted-foreground">The role title used to compare candidates.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-title">Role title <span className="text-destructive">*</span></Label>
            <Input id="role-title" aria-invalid={!!errors.role_title} aria-describedby={errors.role_title ? "role-title-error" : undefined} {...register("role_title", { required: "Role title is required" })} />
            {errors.role_title && <p id="role-title-error" className="text-sm text-destructive">{errors.role_title.message}</p>}
          </div>
        </section>

        <section aria-labelledby="vacancy-skills-heading" className="space-y-4 border-t p-5 sm:p-6">
          <div>
            <h2 id="vacancy-skills-heading" className="font-semibold">Expected skills</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose skills and set the level expected for this role.</p>
          </div>
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
              <p className="text-sm font-medium">No skills added</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a skill to describe this role.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <VacancySkillItem
                  key={field.id}
                  skill={watch(`skills.${index}`)}
                  onLevelChange={(level) => setValue(`skills.${index}.expected_level`, level)}
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
          )}
          <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus /> Add skill
          </Button>
        </section>

        <section aria-labelledby="vacancy-context-heading" className="space-y-5 border-t p-5 sm:p-6">
          <div>
            <h2 id="vacancy-context-heading" className="font-semibold">Role context</h2>
            <p className="mt-1 text-sm text-muted-foreground">Optional details used to add context to candidate comparisons.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="culture_dimensions">Company culture</Label>
              <Textarea id="culture_dimensions" rows={4} {...register("culture_dimensions")} />
              <p className="text-sm text-muted-foreground">Used in the culture-fit summary.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competency_expectations">Competency expectations</Label>
              <Textarea id="competency_expectations" rows={4} {...register("competency_expectations")} />
              <p className="text-sm text-muted-foreground">Describe behaviors that matter in this role.</p>
            </div>
          </div>
        </section>

        <div className="space-y-4 border-t bg-muted/20 p-5 sm:px-6">
          <ApiErrorList errors={serverErrors} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
            <Button className="w-full px-5 sm:w-auto" type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(_, taxonomy) => append({
        skill_id: taxonomy.skill_id,
        skill_label: taxonomy.skill_label,
        expected_level: 3,
        l1_anchor: taxonomy.l1_anchor,
        l2_anchor: taxonomy.l2_anchor,
        l3_anchor: taxonomy.l3_anchor,
        l4_anchor: taxonomy.l4_anchor,
        l5_anchor: taxonomy.l5_anchor,
      })} />
    </div>
  );
}
