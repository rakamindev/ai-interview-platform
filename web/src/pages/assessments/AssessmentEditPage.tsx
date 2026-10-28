
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
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
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Languages,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Users,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ListChecks,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
    formState: { errors, isDirty },
  } = form;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
  });

  const assessmentName = watch("name");
  const timeLimit = watch("time_limit_min");
  const language = watch("language");

  useEffect(() => {
    let cancelled = false;

    const loadAssessment = async () => {
      setLoading(true);
      setLoadError(null);
      setError(null);
      setSuccess(false);

      if (!id || !Number.isFinite(Number(id)) || Number(id) <= 0) {
        setLoadError("Assessment ID is invalid.");
        setLoading(false);
        return;
      }

      try {
        const res = await assessmentsApi.get(Number(id));

        if (cancelled) return;

        const assessment = res.data.assessment;

        reset({
          name: assessment.name,
          time_limit_min: assessment.time_limit_min,
          language:
            assessment.language === "id" ? "id" : "en",
          skills: assessment.skills ?? [],
        });
      } catch {
        if (!cancelled) {
          setLoadError(
            "We couldn't load this assessment. Check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [id, reset]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      move(oldIndex, newIndex);
    }
  };

  const getApiErrorMessage = (e: unknown) => {
    if (typeof e !== "object" || e === null || !("response" in e)) {
      return "We couldn't save your changes. Please try again.";
    }

    const response = (e as {
      response?: {
        data?: {
          errors?: Array<{ message?: string } | string>;
          message?: string;
        };
      };
    }).response;

    const firstError = response?.data?.errors?.[0];

    if (typeof firstError === "string") return firstError;
    if (firstError?.message) return firstError.message;
    if (response?.data?.message) return response.data.message;

    return "We couldn't save your changes. Please try again.";
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    setError(null);
    setSuccess(false);

    if (!id || !Number.isFinite(Number(id)) || Number(id) <= 0) {
      setError("The assessment ID is invalid.");
      return;
    }

    if (data.skills.length === 0) {
      setError("Add at least one skill before saving.");
      return;
    }

    const hasEmptySkill = data.skills.some(
      (skill) => !skill.skill_label?.trim()
    );

    if (hasEmptySkill) {
      setError("Please provide a name for every skill.");
      return;
    }

    setSubmitting(true);

    try {
      await assessmentsApi.update(Number(id), {
        name: data.name.trim(),
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((skill, index) => ({
          ...skill,
          skill_label: skill.skill_label?.trim(),
          display_order: index,
        })),
      });

      setSuccess(true);
      navigate(`/assessments/${id}/invite`);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const addCustomSkill = () => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
    setError(null);
  };

  const addTaxonomySkill = (skill: Parameters<typeof append>[0]) => {
    append({
      ...skill,
      display_order: fields.length,
    });
    setError(null);
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <Skeleton className="mb-6 h-6 w-48" />
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="mb-6 h-10 w-full" />
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <Skeleton className="mb-5 h-6 w-44" />
          <Skeleton className="mb-3 h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Unable to load assessment
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {loadError}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => navigate("/assessments")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to assessments
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Link
          to="/assessments"
          className="transition-colors hover:text-foreground"
        >
          Assessments
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground">
          Edit assessment
        </span>
      </nav>

      {/* Page header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-[#01959f]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#01959f]/10">
              <Sparkles className="h-4 w-4" />
            </span>
            Assessment builder
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Edit assessment
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Update the role, interview settings, and skills you want to
            evaluate. Your changes will be saved to this assessment.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => navigate(`/assessments/${id}/invite`)}
        >
          <Users className="mr-2 h-4 w-4" />
          Manage candidates
        </Button>
      </header>

      {/* Form summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#01959f]/10 text-[#01959f]">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="truncate text-sm font-semibold">
              {assessmentName?.trim() || "Untitled role"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Interview duration</p>
            <p className="text-sm font-semibold">{timeLimit} minutes</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Skills selected</p>
            <p className="text-sm font-semibold">
              {fields.length} {fields.length === 1 ? "skill" : "skills"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Role details */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-start gap-3 border-b px-5 py-5 sm:px-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#01959f]/10 text-[#01959f]">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">Role details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Define the position this interview is designed for.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-7">
            <Label htmlFor="name">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Senior Frontend Engineer"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              className="h-11"
              {...register("name", {
                required: "Role title is required.",
                validate: (value) =>
                  value.trim().length > 0 || "Role title cannot be empty.",
              })}
            />
            {errors.name && (
              <p className="text-sm text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Use a clear job title so candidates understand the role.
            </p>
          </div>
        </section>

        {/* Interview settings */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-start gap-3 border-b px-5 py-5 sm:px-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                Interview settings
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how long the interview can run and its language.
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-7">
            <div className="space-y-2">
              <Label htmlFor="time-limit">
                Session time limit <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(timeLimit)}
                onValueChange={(value) => {
                  setValue("time_limit_min", Number(value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setSuccess(false);
                }}
              >
                <SelectTrigger id="time-limit" className="h-11 w-full">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_LIMIT_OPTIONS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The maximum time available for a candidate to complete the
                interview.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interview-language">Interview language</Label>
              <Select
                value={language}
                onValueChange={(value) => {
                  setValue("language", value as "en" | "id", {
                    shouldDirty: true,
                  });
                  setSuccess(false);
                }}
              >
                <SelectTrigger
                  id="interview-language"
                  className="h-11 w-full"
                >
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the language used during the interview.
              </p>
            </div>
          </div>
        </section>

        {/* Skills */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold tracking-tight">
                  Skills to assess
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {fields.length}
                  </span>
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                  Select the skills candidates will be evaluated on. You can
                  reorder them and adjust each skill's expected level.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#01959f]/10 px-3 py-1.5 text-xs font-medium text-[#01959f]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {fields.length > 0 ? "Skills configured" : "Setup required"}
            </span>
          </div>

          <div className="space-y-4 p-5 sm:p-7">
            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#01959f]/10 text-[#01959f]">
                  <ListChecks className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">No skills added yet</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Add at least one skill to define what the interview should
                  evaluate.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((field) => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <SkillCard
                        key={field.id}
                        id={field.id}
                        index={index}
                        form={form}
                        onRemove={() => {
                          remove(index);
                          setError(null);
                          setSuccess(false);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 justify-start whitespace-normal py-3"
                onClick={() => setPickerOpen(true)}
              >
                <span className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#01959f]/10 text-[#01959f]">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-left">
                  <span className="block font-medium">Browse skill taxonomy</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Choose from predefined skills
                  </span>
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 justify-start whitespace-normal py-3"
                onClick={addCustomSkill}
              >
                <span className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-left">
                  <span className="block font-medium">Add a custom skill</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Define a skill specific to this role
                  </span>
                </span>
              </Button>
            </div>

            {fields.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Tip: drag skills to change their order in the assessment.
              </p>
            )}
          </div>
        </section>

        {/* Save errors and actions */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Changes saved successfully.
          </div>
        )}

        <Separator />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => navigate(`/assessments/${id}/invite`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#01959f] text-white hover:bg-[#017f88] sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving changes...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save changes
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addTaxonomySkill}
      />
    </div>
  );
}
