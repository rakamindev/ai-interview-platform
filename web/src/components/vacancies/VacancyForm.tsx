
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Code2,
  Layers3,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";

import type { VacancySkill } from "@/types";
import type { VacancyPayload } from "@/services/vacancies";

export interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

interface VacancyFormProps {
  mode: "create" | "edit";
  initialValues?: VacancyFormValues;
  onSave: (data: VacancyPayload) => Promise<void>;
}

const defaultValues: VacancyFormValues = {
  role_title: "",
  culture_dimensions: "",
  competency_expectations: "",
  skills: [],
};

export default function VacancyForm({
  mode,
  initialValues,
  onSave,
}: VacancyFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<VacancyFormValues>({
    defaultValues: initialValues ?? defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  const skills = watch("skills");

  const addSkill = (skill: Partial<VacancySkill>) => {
    const exists = skills.some(
      (current) =>
        current.skill_label?.trim().toLowerCase() ===
        skill.skill_label?.trim().toLowerCase()
    );

    if (exists) {
      setSubmitError("This skill has already been added.");
      setPickerOpen(false);
      return;
    }

    append({
      skill_id: skill.skill_id,
      skill_label: skill.skill_label ?? "",
      expected_level: 3,
    });

    setSubmitError(null);
    setPickerOpen(false);
  };

  const submit = async (values: VacancyFormValues) => {
    if (submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    const currentIds = new Set(
      values.skills
        .filter((skill) => skill.id != null)
        .map((skill) => Number(skill.id))
    );

    const removedSkills =
      mode === "edit"
        ? (initialValues?.skills ?? [])
            .filter(
              (skill) =>
                skill.id != null &&
                !currentIds.has(Number(skill.id))
            )
            .map((skill) => ({
              id: skill.id,
              _destroy: true,
            }))
        : [];

    try {
      await onSave({
        role_title: values.role_title.trim(),
        culture_dimensions: values.culture_dimensions,
        competency_expectations: values.competency_expectations,
        vacancy_skills_attributes: [
          ...values.skills,
          ...removedSkills,
        ],
      });
    } catch (error: unknown) {
      const response = (
        error as {
          response?: {
            data?: {
              errors?: Array<{ message?: string } | string>;
              error?: string;
              message?: string;
            };
          };
        }
      )?.response;

      const firstError = response?.data?.errors?.[0];

      setSubmitError(
        (typeof firstError === "string"
          ? firstError
          : firstError?.message) ??
          response?.data?.error ??
          response?.data?.message ??
          "Failed to save vacancy. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="space-y-5">
        <Link
          to="/vacancies"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vacancies
        </Link>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Vacancy management
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {mode === "create"
              ? "Create Vacancy"
              : "Edit Vacancy"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Define the role, required skills, and hiring expectations.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Position details
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Basic information about the position.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="max-w-2xl space-y-2">
              <Label
                htmlFor="role_title"
                className="text-sm font-semibold text-slate-700"
              >
                Role title <span className="text-red-500">*</span>
              </Label>

              <Input
                id="role_title"
                placeholder="e.g. Senior Frontend Engineer"
                aria-invalid={Boolean(errors.role_title)}
                className="h-11 rounded-xl border-slate-200"
                {...register("role_title", {
                  validate: (value) =>
                    Boolean(value?.trim()) ||
                    "Role title is required.",
                })}
              />

              {errors.role_title ? (
                <p role="alert" className="text-xs text-red-600">
                  {errors.role_title.message}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Use a clear title that describes the position.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers3 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Skill requirements
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Set the expected level for each competency.
                </p>
              </div>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {fields.length}{" "}
              {fields.length === 1 ? "skill" : "skills"}
            </span>
          </div>

          <div className="space-y-4 p-5 sm:p-7">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Layers3 className="h-6 w-6" />
                </div>

                <p className="text-sm font-bold text-slate-800">
                  No skills added yet
                </p>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add skills from the taxonomy and specify
                  the competency level expected for this role.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const skill = skills[index];

                  return (
                    <div
                      key={field.id}
                      className="rounded-2xl border border-slate-200 p-4 transition-colors hover:border-primary/30 sm:p-5"
                    >
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Layers3 className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-slate-800">
                              {skill?.skill_label}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Required competency
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={`Remove ${skill?.skill_label}`}
                          onClick={() => remove(index)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-600">
                          Expected level
                        </p>

                        <LevelRadio
                          value={skill?.expected_level ?? 3}
                          onChange={(value) =>
                            setValue(
                              `skills.${index}.expected_level`,
                              value,
                              { shouldDirty: true }
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="h-11 w-full rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add skill requirement
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Code2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                AI evaluation context
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Additional information used in AI-generated narratives.
              </p>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <div className="space-y-2">
              <Label
                htmlFor="culture_dimensions"
                className="text-sm font-semibold text-slate-700"
              >
                Company culture
              </Label>

              <Textarea
                id="culture_dimensions"
                placeholder="Describe the team's working style, communication, and values..."
                rows={4}
                className="resize-y rounded-xl border-slate-200"
                {...register("culture_dimensions")}
              />

              <p className="text-xs leading-5 text-slate-500">
                Helps provide organizational context for
                the AI-generated narrative.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="competency_expectations"
                className="text-sm font-semibold text-slate-700"
              >
                Competency expectations
              </Label>

              <Textarea
                id="competency_expectations"
                placeholder="Describe the behaviors and responsibilities expected from the candidate..."
                rows={4}
                className="resize-y rounded-xl border-slate-200"
                {...register("competency_expectations")}
              />

              <p className="text-xs leading-5 text-slate-500">
                Describe expectations that complement
                the required skill levels.
              </p>
            </div>
          </div>
        </section>

        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}

        <div className="flex flex-col-reverse items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
          <p className="text-xs text-slate-500">
            {mode === "edit" && !isDirty
              ? "No changes made yet."
              : "Review the information before saving."}
          </p>

          <div className="flex w-full gap-3 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              asChild
              className="h-11 flex-1 rounded-xl px-5 sm:flex-none"
            >
              <Link to="/vacancies">Cancel</Link>
            </Button>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 flex-1 rounded-xl px-6 shadow-sm shadow-primary/20 sm:flex-none"
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Vacancy"
                  : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addSkill}
      />
    </div>
  );
}