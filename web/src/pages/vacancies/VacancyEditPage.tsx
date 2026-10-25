import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { extractApiError } from "@/lib/apiErrors";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, RefreshCw } from "lucide-react";
import type { VacancySkill } from "@/types";
import { vacancyKeys } from "@/lib/queryKeys";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const vacancyId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, watch, reset } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const vacancyQuery = useQuery({
    queryKey: vacancyKeys.detail(vacancyId),
    queryFn: async () => (await vacanciesApi.get(vacancyId)).data.vacancy,
  });

  const updateMutation = useMutation({
    mutationFn: (data: VacancyFormValues) =>
      vacanciesApi.update(vacancyId, {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(vacancyKeys.detail(vacancyId), response.data.vacancy);
      void queryClient.invalidateQueries({ queryKey: vacancyKeys.lists() });
    },
  });

  useEffect(() => {
    const vacancy = vacancyQuery.data;
    if (!vacancy) return;

    reset({
      role_title: vacancy.role_title,
      culture_dimensions: vacancy.culture_dimensions,
      competency_expectations: vacancy.competency_expectations,
      skills: vacancy.skills,
    });
  }, [reset, vacancyQuery.data]);

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    try {
      await updateMutation.mutateAsync(data);
      navigate("/vacancies");
    } catch (e) {
      // F-26: previously an unhandled rejection — now surfaced to the assessor.
      setError(extractApiError(e).message);
    }
  };

  if (vacancyQuery.isPending) return <div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <span className="text-sm font-medium">Edit Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {vacancyQuery.isError && (
          <Alert>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">Couldn't load this vacancy: {extractApiError(vacancyQuery.error).message}</p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void vacancyQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label>Role title <span className="text-destructive">*</span></Label>
          <Input {...register("role_title", { required: true })} />
        </div>
        <Separator />
        {error && (
          <Alert>
            <p className="text-sm">{error}</p>
          </Alert>
        )}
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
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })} />
    </div>
  );
}
