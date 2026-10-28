
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
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
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Users,
  X,
  ListChecks,
  AlertCircle,
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
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export default function AssessmentNewPage() {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
    mode: "onSubmit",
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
  });

  const roleName = watch("name");
  const timeLimit = watch("time_limit_min");
  const language = watch("language");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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

  const addCustomSkill = () => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
    setError(null);
  };

  const addTaxonomySkill = (skill: Partial<AssessmentSkill>) => {
    append({
      ...skill,
      display_order: fields.length,
    });
    setError(null);
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Tambahkan setidaknya satu skill sebelum melanjutkan.");
      return;
    }

    const hasEmptyCustomSkill = data.skills.some(
      (skill) => skill.is_custom && !skill.skill_label?.trim(),
    );

    if (hasEmptyCustomSkill) {
      setError("Isi nama setiap custom skill atau hapus skill yang masih kosong.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: data.name.trim(),
        time_limit_min: Number(data.time_limit_min),
        language: data.language,
        assessment_skills_attributes: data.skills.map((skill, index) => ({
          ...skill,
          display_order: index,
        })),
      };

      const response = await assessmentsApi.create(payload);
      const assessmentId = response.data.assessment.id;

      navigate(`/assessments/${assessmentId}/invite`);
    } catch (e: unknown) {
      const apiError = e as {
        response?: {
          data?: {
            errors?: Array<{ message?: string }>;
            message?: string;
          };
        };
      };

      setError(
        apiError.response?.data?.errors?.[0]?.message ??
          apiError.response?.data?.message ??
          "Assessment gagal disimpan. Periksa koneksi dan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 pb-10">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          to="/assessments"
          className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Assessments
        </Link>
        <span className="text-muted-foreground/60">/</span>
        <span className="font-medium text-foreground">New assessment</span>
      </nav>

      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Assessment builder
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Create a new assessment
          </h1>

          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Atur posisi yang akan dinilai, waktu interview, bahasa, dan
            kompetensi yang ingin diukur oleh AI.
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground sm:flex">
          <Users className="h-4 w-4 text-primary" />
          <span>AI-powered interview</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="truncate text-sm font-semibold">
                {roleName?.trim() || "Not set yet"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interview duration</p>
              <p className="text-sm font-semibold">{timeLimit} minutes</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Skills selected</p>
              <p className="text-sm font-semibold">
                {fields.length} {fields.length === 1 ? "skill" : "skills"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Position details */}
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-start gap-3 border-b px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Position details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tentukan nama posisi yang akan diwawancarai.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-6">
            <Label htmlFor="name">
              Role title <span className="text-destructive">*</span>
            </Label>

            <Input
              id="name"
              placeholder="Contoh: Senior Frontend Engineer"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              className="h-11"
              {...register("name", {
                required: "Role title wajib diisi.",
                minLength: {
                  value: 2,
                  message: "Role title minimal 2 karakter.",
                },
                maxLength: {
                  value: 120,
                  message: "Role title maksimal 120 karakter.",
                },
              })}
            />

            {errors.name && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.name.message}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Gunakan nama posisi yang jelas agar pertanyaan interview relevan.
            </p>
          </div>
        </section>

        {/* Interview settings */}
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-start gap-3 border-b px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Interview settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Atur durasi dan bahasa yang digunakan AI selama interview.
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="time-limit">Session time limit</Label>

              <Select
                value={String(timeLimit)}
                onValueChange={(value) =>
                  setValue("time_limit_min", Number(value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
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
                Durasi maksimum untuk satu sesi interview.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interview-language">Interview language</Label>

              <Select
                value={language}
                onValueChange={(value) =>
                  setValue("language", value as "en" | "id", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="interview-language" className="h-11 w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    <span className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4" />
                      English
                    </span>
                  </SelectItem>
                  <SelectItem value="id">
                    <span className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4" />
                      Bahasa Indonesia
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                Pilih bahasa utama untuk pertanyaan interview AI.
              </p>
            </div>
          </div>
        </section>

        {/* Skills */}
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col justify-between gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Skills to assess</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilih kompetensi yang akan dinilai selama interview.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {fields.length} selected
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed px-4 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <ListChecks className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold">No skills added yet</h3>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Tambahkan skill dari taxonomy atau buat custom skill agar AI
                  dapat menilai kompetensi kandidat.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Browse skill taxonomy
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Atur urutan skill sesuai prioritas. Gunakan kontrol pada
                  setiap skill untuk menyesuaikan level atau menghapusnya.
                </div>

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
                          onRemove={() => remove(index)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-center"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add from Skill Taxonomy
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 justify-center"
                onClick={addCustomSkill}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add custom skill
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Minimal satu skill diperlukan untuk membuat assessment.
            </p>
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1 leading-6">{error}</div>
            <button
              type="button"
              aria-label="Dismiss error"
              className="rounded-md p-1 transition-colors hover:bg-destructive/10"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form actions */}
        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="hidden text-xs text-muted-foreground md:block">
            <span className="text-destructive">*</span> Wajib diisi
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={submitting}
              onClick={() => navigate("/assessments")}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="h-11"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating assessment...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create assessment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
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
