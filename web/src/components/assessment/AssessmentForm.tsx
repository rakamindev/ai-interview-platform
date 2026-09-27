
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useFieldArray,
  useForm,
} from "react-hook-form";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  Code2,
  Globe2,
  Layers3,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";

import { TIME_LIMIT_OPTIONS } from "@/utils/constants";

import type { AssessmentSkill } from "@/types";
import type { AssessmentPayload } from "@/services/assessments";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

interface AssessmentFormProps {
  mode: "create" | "edit";
  initialValues?: AssessmentFormValues;
  onSave: (data: AssessmentPayload) => Promise<void>;
  cancelHref?: string;
}

const defaultValues: AssessmentFormValues = {
  name: "",
  time_limit_min: 45,
  language: "en",
  skills: [],
};

function getErrorMessage(error: unknown): string {
  const response = (
    error as {
      response?: {
        data?: {
          errors?: Array<
            string | { message?: string }
          >;
          error?: string;
          message?: string;
        };
      };
    }
  )?.response;

  const firstError = response?.data?.errors?.[0];

  return (
    (typeof firstError === "string"
      ? firstError
      : firstError?.message) ??
    response?.data?.error ??
    response?.data?.message ??
    "Failed to save assessment. Please try again."
  );
}

export default function AssessmentForm({
  mode,
  initialValues,
  onSave,
  cancelHref = "/assessments",
}: AssessmentFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] =
    useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: initialValues ?? defaultValues,
    shouldFocusError: true,
  });

  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  const {
    fields,
    append,
    remove,
    move,
  } = useFieldArray({
    control,
    name: "skills",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter:
        sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (
    event: DragEndEvent
  ) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = fields.findIndex(
      (field) => field.id === active.id
    );

    const newIndex = fields.findIndex(
      (field) => field.id === over.id
    );

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    move(oldIndex, newIndex);
  };

  const addTaxonomySkill = (
    skill: Partial<AssessmentSkill>
  ) => {
    const currentSkills = getValues("skills");

    const duplicate = currentSkills.some(
      (current) =>
        current.skill_label
          ?.trim()
          .toLowerCase() ===
        skill.skill_label
          ?.trim()
          .toLowerCase()
    );

    if (duplicate) {
      setSubmitError(
        "This skill has already been added."
      );
      setPickerOpen(false);
      return;
    }

    append({
      ...skill,
      is_custom: false,
      expected_level:
        skill.expected_level ?? 3,
      display_order: fields.length,
    });

    setSubmitError(null);
    setPickerOpen(false);
  };

  const addCustomSkill = () => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
      scope_include: "",
      scope_exclude: "",
      l1_anchor: "",
      l2_anchor: "",
      l3_anchor: "",
      l4_anchor: "",
      l5_anchor: "",
    });

    setSubmitError(null);
  };

  const onSubmit = async (
    values: AssessmentFormValues
  ) => {
    if (submitting) return;

    if (values.skills.length === 0) {
      setSubmitError(
        "Add at least one skill to continue."
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const existingIds = new Set(
      values.skills
        .filter((skill) => skill.id != null)
        .map((skill) => Number(skill.id))
    );

    const removedSkills: Partial<AssessmentSkill>[] =
      mode === "edit"
        ? (initialValues?.skills ?? [])
            .filter(
              (skill) =>
                skill.id != null &&
                !existingIds.has(
                  Number(skill.id)
                )
            )
            .map((skill) => ({
              id: skill.id,
              _destroy: true,
            }))
        : [];

    const payload: AssessmentPayload = {
      name: values.name.trim(),
      time_limit_min:
        values.time_limit_min,
      language: values.language,
      assessment_skills_attributes: [
        ...values.skills.map(
          (skill, index) => ({
            ...skill,
            display_order: index,
          })
        ),
        ...removedSkills,
      ],
    };

    try {
      await onSave(payload);
    } catch (error) {
      setSubmitError(
        getErrorMessage(error)
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="space-y-5">
        <Link
          to={cancelHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessment
        </Link>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Assessment Management
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {mode === "create"
              ? "Create Assessment"
              : "Edit Assessment"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Configure your interview and
            select the skills to assess.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Interview Details
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Basic interview configuration.
              </p>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <div className="max-w-2xl space-y-2">
              <Label
                htmlFor="assessment-name"
                className="text-sm font-semibold text-slate-700"
              >
                Assessment Name{" "}
                <span className="text-red-500">
                  *
                </span>
              </Label>

              <Input
                id="assessment-name"
                placeholder="e.g. Senior Frontend Engineer"
                aria-invalid={
                  Boolean(errors.name)
                }
                className="h-11 rounded-xl border-slate-200"
                {...register("name", {
                  validate: (value) =>
                    Boolean(value?.trim()) ||
                    "Assessment name is required.",
                })}
              />

              {errors.name ? (
                <p
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {errors.name.message}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Use a descriptive name to
                  identify this assessment.
                </p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="assessment-duration"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                  <Clock3 className="h-4 w-4 text-primary" />
                  Session Time Limit
                </Label>

                <Select
                  value={String(
                    watch("time_limit_min")
                  )}
                  onValueChange={(value) =>
                    setValue(
                      "time_limit_min",
                      Number(value),
                      {
                        shouldDirty: true,
                      }
                    )
                  }
                >
                  <SelectTrigger
                    id="assessment-duration"
                    className="h-11 rounded-xl border-slate-200"
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {TIME_LIMIT_OPTIONS.map(
                      (minutes) => (
                        <SelectItem
                          key={minutes}
                          value={String(minutes)}
                        >
                          {minutes} minutes
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                <p className="text-xs leading-5 text-slate-500">
                  Maximum duration of each
                  interview session.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="assessment-language"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                  <Globe2 className="h-4 w-4 text-primary" />
                  Interview Language
                </Label>

                <Select
                  value={watch("language")}
                  onValueChange={(value) =>
                    setValue(
                      "language",
                      value as "en" | "id",
                      {
                        shouldDirty: true,
                      }
                    )
                  }
                >
                  <SelectTrigger
                    id="assessment-language"
                    className="h-11 rounded-xl border-slate-200"
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="en">
                      English
                    </SelectItem>

                    <SelectItem value="id">
                      Indonesian
                    </SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs leading-5 text-slate-500">
                  Language used during the
                  AI interview.
                </p>
              </div>
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
                  Skills to Assess
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Select and prioritize
                  interview competencies.
                </p>
              </div>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {fields.length}{" "}
              {fields.length === 1
                ? "skill"
                : "skills"}
            </span>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Layers3 className="h-7 w-7" />
                </div>

                <h3 className="text-sm font-bold text-slate-900">
                  No Skills Added Yet
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Select a skill from the B7
                  taxonomy or create a custom
                  skill to get started.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={
                  closestCenter
                }
                onDragEnd={
                  handleDragEnd
                }
              >
                <SortableContext
                  items={fields.map(
                    (field) => field.id
                  )}
                  strategy={
                    verticalListSortingStrategy
                  }
                >
                  <div className="space-y-4">
                    {fields.map(
                      (field, index) => (
                        <div
                          key={field.id}
                          className="rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-primary/30 sm:p-4"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3 px-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Skill {index + 1}
                            </span>

                            <span className="text-xs text-slate-400">
                              Drag to reorder
                            </span>
                          </div>

                          <SkillCard
                            id={field.id}
                            index={index}
                            form={form}
                            onRemove={() =>
                              remove(index)
                            }
                          />
                        </div>
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setPickerOpen(true)
                }
                className="h-12 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add from B7 Taxonomy
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={
                  addCustomSkill
                }
                className="h-12 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Skill
              </Button>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />

              <p className="text-xs leading-5 text-slate-500">
                Drag skills to adjust their
                order. Custom skills require
                a name, scope, and all five
                competency anchors.
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
              : "Review the assessment before saving."}
          </p>

          <div className="flex w-full gap-3 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className="h-11 flex-1 rounded-xl px-5 sm:flex-none"
              onClick={() => {
                window.location.href =
                  cancelHref;
              }}
            >
              Cancel
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
                ? "Save & Continue"
                : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={
          addTaxonomySkill
        }
      />
    </div>
  );
}