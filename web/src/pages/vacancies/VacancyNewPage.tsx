import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Callout } from "@/components/ui/callout";
import { FieldError, FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import SkillPicker from "@/components/assessment/SkillPicker";
import VacancySkillRow from "@/components/vacancy/VacancySkillRow";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Loader2 } from "lucide-react";
import type { VacancySkill } from "@/types";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.create({
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell width="narrow">
      <PageHeader title="New Vacancy" back={{ to: "/vacancies", label: "Back to vacancies" }}
                  description="A role and the skill levels it requires." />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormSection title="Details">
          <div className="space-y-1.5">
            <Label htmlFor="role_title">Role title <span aria-hidden="true" className="text-destructive">*</span></Label>
            <Input id="role_title" placeholder="Senior Frontend Engineer" aria-required="true"
                   aria-invalid={errors.role_title ? true : undefined}
                   aria-describedby={errors.role_title ? "role_title-error" : undefined}
                   {...register("role_title", { required: "Role title is required" })} />
            <FieldError id="role_title-error">{errors.role_title?.message}</FieldError>
          </div>
        </FormSection>

        <FormSection title="Expected skills" description="The level a new hire needs for each skill. The fit/gap report compares candidates against these levels.">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {fields.map((field, index) => (
                <VacancySkillRow key={field.id} label={watch(`skills.${index}.skill_label`) ?? ""}
                                 level={watch(`skills.${index}.expected_level`) ?? 3}
                                 onLevelChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                                 onRemove={() => remove(index)} />
              ))}
            </ul>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Add skill expectation
          </Button>
        </FormSection>

        <FormSection title="Context for the AI narrative" description="Optional. Used only to write the narrative of the fit/gap report, not to compute levels.">
          <div className="space-y-1.5">
            <Label htmlFor="culture_dimensions">Company culture (used in AI narrative)</Label>
            <Textarea id="culture_dimensions" placeholder="Ownership-driven, async-first, direct feedback culture..." rows={3} {...register("culture_dimensions")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competency_expectations">Competency expectations (used in AI narrative)</Label>
            <Textarea id="competency_expectations" placeholder="Strong communicator who can align cross-functional teams..." rows={3} {...register("competency_expectations")} />
          </div>
        </FormSection>

        {error && <Callout variant="error" role="alert" title={error} />}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />}
            Save Vacancy
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
      />
    </PageShell>
  );
}
