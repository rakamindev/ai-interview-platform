import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Layers,
  Briefcase,
  Building2,
  Award,
} from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, watch, reset } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        const v = res.data.vacancy;
        reset({
          role_title: v.role_title,
          culture_dimensions: v.culture_dimensions || "",
          competency_expectations: v.competency_expectations || "",
          skills: v.skills || [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal memperbarui lowongan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pt-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/vacancies"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#01959f] transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-[#01959f]/40 flex items-center justify-center transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span>Kembali ke Daftar Lowongan</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#01959f] text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Vacancy Profile Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Edit Lowongan
          </h1>
          <p className="text-sm text-slate-500">
            Sesuaikan ekspektasi kompetensi dan kultur tim untuk evaluasi fit-gap AI.
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50/70 rounded-2xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Informasi Pokok Role */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#01959f] flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Judul Jabatan / Role</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role_title" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Role Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="role_title"
              placeholder="Contoh: Senior Frontend Engineer"
              className="h-11 rounded-xl border-slate-200 focus:border-[#01959f]"
              {...register("role_title", { required: true })}
            />
          </div>
        </div>

        {/* Card 2: Expected Skills */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#01959f] flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Ekspektasi Kompetensi (Skills)</h2>
                <p className="text-xs text-slate-500">Keahlian dan target level yang harus dikuasai oleh kandidat.</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="rounded-xl border-[#01959f]/30 text-[#01959f] hover:bg-teal-50 text-xs font-semibold h-9 px-3.5"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Skill B7
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50/50 space-y-3">
              <Award className="h-8 w-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Belum Ada Skill Ditambahkan</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Pilih skill dari taksonomi B7 untuk memetakan level kompetensi minimum yang diharapkan.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="gradient-teal text-white rounded-xl text-xs h-9 px-4 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Pilih dari Taksonomi Skill
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3 hover:border-teal-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-100 text-[#01959f] text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {watch(`skills.${index}.skill_label`)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Hapus Skill"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    <span className="text-xs font-semibold text-slate-600 block">
                      Target Level yang Diharapkan:
                    </span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Konteks Kultur & Ekspektasi AI */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#01959f] flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Konteks Kultur & Perilaku (AI Narrative)</h2>
              <p className="text-xs text-slate-500">Memberi pemahaman pada AI untuk mengevaluasi kesesuaian budaya kerja.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="culture_dimensions" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Company Culture Dimensions
                </Label>
                <span className="text-[11px] text-slate-400">Opsional</span>
              </div>
              <Textarea
                id="culture_dimensions"
                rows={3}
                placeholder="Contoh: Ownership tinggi, async-first, komunikasi transparan dan cepat beradaptasi..."
                className="rounded-2xl border-slate-200 focus:border-[#01959f] resize-none"
                {...register("culture_dimensions")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="competency_expectations" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Competency Expectations
                </Label>
                <span className="text-[11px] text-slate-400">Opsional</span>
              </div>
              <Textarea
                id="competency_expectations"
                rows={3}
                placeholder="Contoh: Mampu memimpin diskusi teknis lintas tim, mandiri menyelesaikan kendala produksi..."
                className="rounded-2xl border-slate-200 focus:border-[#01959f] resize-none"
                {...register("competency_expectations")}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/vacancies")}
            className="rounded-xl border-slate-200 h-11 px-5 text-xs font-semibold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="gradient-teal text-white hover:opacity-95 rounded-xl h-11 px-6 text-xs font-semibold shadow-md shadow-teal-500/20"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...
              </>
            ) : (
              "Perbarui Profil Lowongan"
            )}
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(skill) => {
          append({
            skill_id: skill.skill_id ?? "",
            skill_label: skill.skill_label ?? "",
            expected_level: 3,
          });
        }}
      />
    </div>
  );
}
