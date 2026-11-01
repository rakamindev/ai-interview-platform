import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SkillPicker from "@/components/assessment/SkillPicker";
import FieldError from "@/components/FieldError";
import EmptyState from "@/components/EmptyState";
import FormSection from "@/components/FormSection";
import Notice from "@/components/Notice";
import PageHeader from "@/components/layout/PageHeader";
import VacancySkillRow from "@/components/vacancy/VacancySkillRow";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { vacanciesApi } from "@/services/vacancies";
import { getApiErrorMessage } from "@/lib/apiError";
import { MAX_TEXT_FIELD_LENGTH, requiredText } from "@/utils/validation";
import { ListChecks, Plus, Loader2 } from "lucide-react";
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

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
    rules: { required: "At least one skill is required" },
  });
  const { blocker, allowNavigation } = useUnsavedChangesGuard(isDirty);

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.create({
        role_title: data.role_title.trim(),
        culture_dimensions: data.culture_dimensions.trim(),
        competency_expectations: data.competency_expectations.trim(),
        vacancy_skills_attributes: data.skills,
      });
      allowNavigation();
      navigate("/vacancies");
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, "Failed to save vacancy."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo="/vacancies"
        backLabel="Back to vacancies"
        eyebrow="New vacancy"
        title="Describe an open role"
        description="Fit/gap reports compare a candidate's portfolio with these expectations."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection title="Role">
          <div className="space-y-2">
            <Label htmlFor="role_title">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role_title"
              placeholder="Senior Frontend Engineer"
              maxLength={MAX_TEXT_FIELD_LENGTH}
              aria-invalid={!!errors.role_title}
              {...register("role_title", requiredText("Role title is required"))}
            />
            <FieldError message={errors.role_title?.message} />
          </div>
        </FormSection>

        <FormSection
          title="Expected skills"
          description="Required. Add the levels a strong hire for this role should demonstrate."
        >
          {fields.length === 0 ? (
            <EmptyState icon={ListChecks} title="No skills added yet." />
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <VacancySkillRow
                  key={field.id}
                  label={watch(`skills.${index}.skill_label`) ?? ""}
                  level={watch(`skills.${index}.expected_level`) ?? 3}
                  onLevelChange={(v) =>
                    setValue(`skills.${index}.expected_level`, v, { shouldDirty: true })
                  }
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus /> Add skill expectation
          </Button>
          <FieldError message={errors.skills?.root?.message} />
        </FormSection>

        <FormSection
          title="Culture and competencies"
          description="Used to write the narrative in fit/gap reports."
        >
          <div className="space-y-2">
            <Label htmlFor="culture_dimensions">
              Company culture <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="culture_dimensions"
              placeholder="Ownership-driven, async-first, direct feedback culture..."
              rows={3}
              aria-invalid={!!errors.culture_dimensions}
              {...register("culture_dimensions", requiredText("Company culture is required"))}
            />
            <FieldError message={errors.culture_dimensions?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="competency_expectations">
              Competency expectations <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="competency_expectations"
              placeholder="Strong communicator who can align cross-functional teams..."
              rows={3}
              aria-invalid={!!errors.competency_expectations}
              {...register(
                "competency_expectations",
                requiredText("Competency expectations are required"),
              )}
            />
            <FieldError message={errors.competency_expectations?.message} />
          </div>
        </FormSection>

        {error && <Notice variant="error">{error}</Notice>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Save Vacancy
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog blocker={blocker} />

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) =>
          append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })
        }
        addedLabels={watch("skills").map((s) => s.skill_label ?? "")}
      />
    </div>
  );
}
