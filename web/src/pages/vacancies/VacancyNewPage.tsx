
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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

export default function VacancyNewPage() {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  const roleTitle = watch("role_title");

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);

    try {
      await vacanciesApi.create({
        role_title: data.role_title.trim(),
        culture_dimensions: data.culture_dimensions.trim(),
        competency_expectations: data.competency_expectations.trim(),
        vacancy_skills_attributes: data.skills.map((skill) => ({
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          expected_level: skill.expected_level ?? 3,
        })),
      });

      navigate("/vacancies");
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
          "Lowongan gagal disimpan. Periksa koneksi dan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addSkill = (skill: {
    skill_id?: number;
    skill_label?: string;
  }) => {
    const alreadyAdded = fields.some(
      (field) =>
        (skill.skill_id != null && field.skill_id === skill.skill_id) ||
        (skill.skill_id == null &&
          field.skill_label === skill.skill_label),
    );

    if (alreadyAdded) {
      setError("Skill tersebut sudah ditambahkan.");
      return;
    }

    append({
      skill_id: skill.skill_id,
      skill_label: skill.skill_label,
      expected_level: 3,
    });

    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 pb-10">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          to="/vacancies"
          className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Vacancies
        </Link>

        <span className="text-muted-foreground/60">/</span>
        <span className="font-medium text-foreground">New vacancy</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Recruitment management
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Create a new vacancy
          </h1>

          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Tentukan posisi, kompetensi yang dibutuhkan, dan budaya kerja
            untuk membantu AI menghasilkan evaluasi kandidat yang lebih relevan.
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground sm:flex">
          <Users className="h-4 w-4 text-primary" />
          Hiring workspace
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Position title</p>
              <p className="truncate text-sm font-semibold">
                {roleTitle?.trim() || "Not set yet"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Expected competencies
              </p>
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
                Mulai dengan menentukan nama posisi yang dibutuhkan.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-6">
            <Label htmlFor="role_title">
              Role title <span className="text-destructive">*</span>
            </Label>

            <Input
              id="role_title"
              placeholder="Contoh: Senior Frontend Engineer"
              autoComplete="off"
              aria-invalid={Boolean(errors.role_title)}
              className="h-11"
              {...register("role_title", {
                required: "Role title wajib diisi.",
                minLength: {
                  value: 2,
                  message: "Role title minimal 2 karakter.",
                },
                maxLength: {
                  value: 120,
                  message: "Role title maksimal 120 karakter.",
                },
                validate: (value) =>
                  value.trim().length > 0 ||
                  "Role title tidak boleh hanya berisi spasi.",
              })}
            />

            {errors.role_title && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.role_title.message}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Gunakan nama posisi yang jelas untuk membantu AI memahami
              kebutuhan rekrutmen.
            </p>
          </div>
        </section>

        {/* Skills */}
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col justify-between gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Target className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">Expected skills</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilih skill dan tentukan level kompetensi yang diharapkan.
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
                  <Target className="h-6 w-6 text-muted-foreground" />
                </div>

                <h3 className="text-sm font-semibold">No skills added yet</h3>

                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Tambahkan kompetensi yang relevan agar ekspektasi kandidat
                  lebih jelas.
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
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const skillLabel =
                    watch(`skills.${index}.skill_label`) ||
                    "Untitled skill";

                  return (
                    <div
                      key={field.id}
                      className="rounded-xl border bg-background p-4 transition-colors hover:border-primary/30 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Target className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="break-words text-sm font-semibold">
                              {skillLabel}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Expected proficiency level
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${skillLabel}`}
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Separator className="my-4" />

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Expected level
                        </Label>

                        <LevelRadio
                          value={
                            watch(`skills.${index}.expected_level`) ?? 3
                          }
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
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add skill expectation
            </Button>

            <p className="text-xs leading-5 text-muted-foreground">
              Pilih hanya skill yang relevan dengan posisi agar penilaian
              kandidat tetap terarah.
            </p>
          </div>
        </section>

        {/* Company culture */}
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-start gap-3 border-b px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Lightbulb className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold">Company culture</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gambarkan lingkungan dan cara kerja perusahaan.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-6">
            <Label htmlFor="culture_dimensions">
              Culture dimensions
            </Label>

            <Textarea
              id="culture_dimensions"
              placeholder="Contoh: Ownership-driven, async-first, collaborative, direct feedback culture..."
              rows={4}
              className="resize-y"
              {...register("culture_dimensions", {
                maxLength: {
                  value: 5000,
                  message: "Deskripsi budaya perusahaan terlalu panjang.",
                },
              })}
            />

            {errors.culture_dimensions && (
              <p className="text-xs text-destructive">
                {errors.culture_dimensions.message}
              </p>
            )}

            <p className="text-xs leading-5 text-muted-foreground">
              Informasi ini digunakan sebagai konteks untuk narasi AI.
              Jelaskan nilai atau perilaku yang penting bagi tim.
            </p>
          </div>
        </section>

        {/* Competency expectations */}
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-start gap-3 border-b px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold">Competency expectations</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jelaskan karakteristik dan kemampuan yang dicari.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-6">
            <Label htmlFor="competency_expectations">
              Ideal candidate profile
            </Label>

            <Textarea
              id="competency_expectations"
              placeholder="Contoh: Strong communicator who can align cross-functional teams, explain technical trade-offs, and take ownership of delivery..."
              rows={4}
              className="resize-y"
              {...register("competency_expectations", {
                maxLength: {
                  value: 5000,
                  message: "Ekspektasi kompetensi terlalu panjang.",
                },
              })}
            />

            {errors.competency_expectations && (
              <p className="text-xs text-destructive">
                {errors.competency_expectations.message}
              </p>
            )}

            <p className="text-xs leading-5 text-muted-foreground">
              Berikan konteks tambahan agar narasi AI lebih sesuai dengan
              kebutuhan posisi. Bagian ini dapat dibiarkan kosong.
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
            <p className="flex-1 leading-6">{error}</p>

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

        {/* Actions */}
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
              onClick={() => navigate("/vacancies")}
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
                  Saving vacancy...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save vacancy
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
        onSelect={addSkill}
      />
    </div>
  );
}
