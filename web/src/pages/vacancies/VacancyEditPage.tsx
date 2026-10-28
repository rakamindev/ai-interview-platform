
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Loader2,
  Plus,
  Save,
  Target,
  Users,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import type { VacancySkill } from "@/types";

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
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
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
  });

  const selectedSkills = watch("skills");

  useEffect(() => {
    let active = true;

    async function loadVacancy() {
      setLoading(true);
      setLoadError("");

      if (!id || !Number.isFinite(Number(id)) || Number(id) <= 0) {
        setLoadError("Invalid vacancy ID.");
        setLoading(false);
        return;
      }

      try {
        const res = await vacanciesApi.get(Number(id));
        if (!active) return;

        const vacancy = res.data.vacancy;

        reset({
          role_title: vacancy.role_title ?? "",
          culture_dimensions: vacancy.culture_dimensions ?? "",
          competency_expectations:
            vacancy.competency_expectations ?? "",
          skills: (vacancy.skills ?? []).map(
            (skill: Partial<VacancySkill>) => ({
              ...skill,
              expected_level: skill.expected_level ?? 3,
            }),
          ),
        });
      } catch {
        if (active) {
          setLoadError(
            "Gagal memuat data lowongan. Silakan coba kembali.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadVacancy();

    return () => {
      active = false;
    };
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    if (!id || !Number.isFinite(Number(id)) || Number(id) <= 0) {
      setSubmitError("Invalid vacancy ID.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title.trim(),
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });

      navigate("/vacancies");
    } catch {
      setSubmitError(
        "Gagal menyimpan perubahan. Silakan periksa kembali dan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addSkill = (skill: {
    skill_id?: number;
    skill_label?: string;
  }) => {
    const duplicate = selectedSkills.some(
      (selected) =>
        (skill.skill_id != null &&
          selected.skill_id === skill.skill_id) ||
        (skill.skill_label &&
          selected.skill_label?.trim().toLowerCase() ===
            skill.skill_label.trim().toLowerCase()),
    );

    if (duplicate) {
      setPickerOpen(false);
      return;
    }

    append({
      skill_id: skill.skill_id,
      skill_label: skill.skill_label,
      expected_level: 3,
    });

    setPickerOpen(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to="/vacancies"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>

        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"
        >
          <AlertCircle className="mb-3 h-5 w-5 text-red-600" />
          <h2 className="font-semibold">Unable to load vacancy</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {loadError}
          </p>
          <Button
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Link to="/vacancies" className="hover:text-foreground">
          Vacancies
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">
          Edit vacancy
        </span>
      </nav>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Edit vacancy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Perbarui detail posisi dan persyaratan kandidat.
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link to="/vacancies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to list
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BriefcaseBusiness className="h-4 w-4" />
            <span className="text-xs font-medium">Role profile</span>
          </div>
          <p className="mt-2 text-sm font-semibold">Position details</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tentukan nama posisi pekerjaan.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium">
              Skill requirements
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold">
            {fields.length}{" "}
            {fields.length === 1 ? "skill" : "skills"} selected
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Atur tingkat penguasaan yang dibutuhkan.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">
              Hiring criteria
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold">
            Culture and competency
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Atur budaya kerja dan kompetensi kandidat.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <BriefcaseBusiness className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold">Position details</h2>
              <p className="text-xs text-muted-foreground">
                Masukkan nama posisi yang akan direkrut.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-6">
            <Label htmlFor="role_title">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role_title"
              placeholder="e.g. Frontend Engineer"
              aria-invalid={Boolean(errors.role_title)}
              {...register("role_title", {
                required: "Role title is required.",
                validate: (value) =>
                  value.trim().length > 0 ||
                  "Role title cannot be empty.",
              })}
            />
            {errors.role_title && (
              <p className="text-sm text-destructive">
                {errors.role_title.message}
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold">Expected skills</h2>
                <p className="text-xs text-muted-foreground">
                  Pilih keterampilan dan tingkat penguasaan yang dibutuhkan.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add skill
            </Button>
          </div>

          <div className="space-y-3 p-5 sm:p-6">
            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Target className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  No skills added yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tambahkan keterampilan yang dibutuhkan untuk posisi ini.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add skill
                </Button>
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-xl border p-4 transition-colors hover:border-teal-200 dark:hover:border-teal-900"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="break-words text-sm font-semibold">
                        {watch(`skills.${index}.skill_label`) ||
                          `Skill ${index + 1}`}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${watch(`skills.${index}.skill_label`) || `skill ${index + 1}`}`}
                      onClick={() => remove(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="mb-3 text-xs text-muted-foreground">
                    Expected proficiency level
                  </p>
                  <LevelRadio
                    value={watch(`skills.${index}.expected_level`) ?? 3}
                    onChange={(value) =>
                      setValue(
                        `skills.${index}.expected_level`,
                        value,
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        },
                      )
                    }
                  />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold">Hiring criteria</h2>
              <p className="text-xs text-muted-foreground">
                Atur budaya kerja dan kompetensi yang diharapkan.
              </p>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="culture_dimensions">
                Company culture
              </Label>
              <Textarea
                id="culture_dimensions"
                rows={4}
                placeholder="Describe your team's values and working culture..."
                {...register("culture_dimensions")}
              />
              <p className="text-xs text-muted-foreground">
                Jelaskan nilai dan cara kerja tim.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="competency_expectations">
                Competency expectations
              </Label>
              <Textarea
                id="competency_expectations"
                rows={4}
                placeholder="Describe the skills and competencies expected..."
                {...register("competency_expectations")}
              />
              <p className="text-xs text-muted-foreground">
                Tentukan kemampuan yang diharapkan dari kandidat.
              </p>
            </div>
          </div>
        </section>

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{submitError}</p>
            <button
              type="button"
              onClick={() => setSubmitError("")}
              aria-label="Dismiss error"
              className="ml-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Your changes will be saved to this vacancy.
            </p>

            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/vacancies")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {submitting ? "Saving..." : "Save changes"}
                {!submitting && (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
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
