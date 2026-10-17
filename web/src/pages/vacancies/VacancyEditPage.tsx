import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, Trash2, Sparkles } from "lucide-react";
import type { VacancySkill } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";

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
  const [deleting, setDeleting] = useState(false);
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
    setSubmitting(true);
    setError(null);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menyimpan perubahan lowongan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await vacanciesApi.delete(Number(id));
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menghapus lowongan pekerjaan.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <RakaminSpinner text="Memuat data lowongan role..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Link to="/vacancies" className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xs text-slate-500">Lowongan</span>
          <span className="text-xs text-slate-400">/</span>
          <span className="text-xs font-bold text-slate-900">Edit Lowongan #{id}</span>
        </div>

        {/* Delete button trigger */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto h-10 sm:h-9 rounded-xl text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60 justify-center"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Hapus Lowongan
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                Konfirmasi Hapus Lowongan?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-slate-600">
                Tindakan ini akan menghapus data lowongan dan target rubrik kompetensi dari sistem secara permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold"
              >
                Ya, Hapus Permanen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Hero Banner */}
      <HeroBanner
        badgeText="⭐️ Role Vacancy & Rubric Editor"
        title="Edit Profil Lowongan Pekerjaan"
        highlightText="Standar B7"
        subtitle="Perbarui target rubrik kompetensi, dimensi budaya kerja, dan ekspektasi performa kandidat."
        bulletPoints={[
          "Penetapan dimensi kesesuaian kultur (Culture Dimensions)",
          "Ekspektasi kompetensi B7 terstandarisasi per level",
          "Sinkronisasi langsung dengan perbandingan fit/gap otomatis",
        ]}
        imageSrc="/images/counseling.png"
        imageAlt="Rakamin Edit Vacancy"
        imageFloatingBadge={{
          title: "Standar Role",
          subtitle: "B7 Taxonomy",
        }}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Role Information */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#01959f]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Informasi Posisi Lowongan
            </h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role_title" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Judul Role / Lowongan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role_title"
              placeholder="Contoh: Senior Frontend Engineer"
              className="h-12 text-sm sm:text-base font-semibold rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              {...register("role_title", { required: true })}
            />
          </div>
        </div>

        {/* Card 2: Expected skills */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fbc036]" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Target Benchmark Rubrik Kompetensi (B7)
              </h3>
            </div>
            <span className="text-xs font-semibold bg-teal-50 text-[#01808a] px-2.5 py-0.5 rounded-full border border-teal-100">
              {fields.length} Skill Terdaftar
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Tentukan ekspektasi minimum level kompetensi (L1 Beginner hingga L5 Expert) yang dibutuhkan untuk role ini.
          </p>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-700">Belum ada target skill ditambahkan</p>
              <p className="text-xs text-slate-500">
                Tambahkan target benchmark rubrik kompetensi untuk kalkulasi Fit/Gap report otomatis.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/40 hover:bg-white transition-colors space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{watch(`skills.${index}.skill_label`)}</span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Hapus skill"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-600">Target Level yang Diharapkan:</span>
                    <LevelRadio
                      name={`skill-${index}`}
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="w-full sm:w-auto rounded-xl text-xs sm:text-sm font-semibold h-11 min-h-[44px] px-4 border-[#01959f]/40 text-[#01959f] hover:bg-teal-50 justify-center shadow-2xs"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Tambah dari Taksonomi Standar B7
            </Button>
          </div>
        </div>

        {/* Card 3: Culture & Competency narrative */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="h-4 w-4 text-[#01959f]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Dimensi Kultur Perusahaan &amp; Konteks Naratif AI
            </h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="culture_dimensions" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Dimensi Kultur Perusahaan (Culture Dimensions)
            </Label>
            <Textarea
              id="culture_dimensions"
              placeholder="Contoh: Tim berorientasi kepemilikan tinggi (ownership), komunikasi asinkron, transparan, dan mengutamakan umpan balik langsung..."
              rows={3}
              className="rounded-xl p-3.5 text-sm bg-slate-50/50 border-slate-200 focus:bg-white resize-none"
              {...register("culture_dimensions")}
            />
            <p className="text-[11px] text-slate-400">
              Digunakan oleh LLM untuk mengevaluasi kesesuaian nilai kerja kandidat pada Laporan Fit/Gap.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <Label htmlFor="competency_expectations" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ekspektasi Kompetensi Tambahan (Competency Expectations)
            </Label>
            <Textarea
              id="competency_expectations"
              placeholder="Contoh: Mampu memimpin arsitektur sistem berskala besar dan membimbing engineer junior secara efektif..."
              rows={3}
              className="rounded-xl p-3.5 text-sm bg-slate-50/50 border-slate-200 focus:bg-white resize-none"
              {...register("competency_expectations")}
            />
            <p className="text-[11px] text-slate-400">
              Konteks kualitatif tambahan yang dipertimbangkan AI dalam menyusun rekomendasi keputusan hiring.
            </p>
          </div>
        </div>

        {error && (
          <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive font-medium">
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-center sm:justify-end gap-3 pt-3 w-full">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-11 px-6 font-semibold"
            onClick={() => navigate("/vacancies")}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="cta"
            className="rounded-xl h-11 px-6 font-bold shadow-xs"
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Perubahan
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
      />
    </div>
  );
}
