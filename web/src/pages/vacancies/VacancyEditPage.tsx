import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingBlock } from "@/components/shared/EmptyState";
import VacancySkillsEditor, {
  type VacancyFormValues,
} from "@/components/vacancy/VacancySkillsEditor";
import { vacanciesApi } from "@/services/vacancies";
import { toVacancySkillsAttributes } from "@/utils/vacancySkills";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialSkillIds, setInitialSkillIds] = useState<number[]>([]);

  const { register, handleSubmit, control, setValue, watch, reset } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [],
    },
  });

  useEffect(() => {
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        const v = res.data.vacancy;
        setInitialSkillIds(v.skills.map((s) => s.id).filter((sid): sid is number => sid != null));
        reset({
          role_title: v.role_title,
          culture_dimensions: v.culture_dimensions,
          competency_expectations: v.competency_expectations,
          skills: v.skills,
        });
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const kept = toVacancySkillsAttributes(data.skills);
      const keptIds = new Set(kept.map((s) => s.id).filter((sid): sid is number => sid != null));
      const destroyed = initialSkillIds
        .filter((sid) => !keptIds.has(sid))
        .map((sid) => ({ id: sid, _destroy: true }));

      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: [...kept, ...destroyed],
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <LoadingBlock rows={2} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            to="/vacancies"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Vacancies
          </Link>
        }
        title="Edit Vacancy"
        description="Update role expectations and skill levels."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label>
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input {...register("role_title", { required: true })} />
        </div>

        <Separator />

        <VacancySkillsEditor
          control={control}
          register={register}
          setValue={setValue}
          watch={watch}
        />

        <Separator />

        <div className="space-y-1.5">
          <Label>Company culture</Label>
          <Textarea rows={3} {...register("culture_dimensions")} />
        </div>

        <div className="space-y-1.5">
          <Label>Competency expectations</Label>
          <Textarea rows={3} {...register("competency_expectations")} />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive break-anywhere">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
