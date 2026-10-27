import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Briefcase,
  Sparkles,
  Building2,
  Users,
  Lightbulb,
  CheckCircle2,
  HeartHandshake,
} from "lucide-react";
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
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const onSubmit = async (data: VacancyFormValues) => {
    if (!data.role_title.trim()) {
      setError("Judul lowongan (role title) wajib diisi.");
      return;
    }
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal membuat lowongan baru.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/vacancies"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Daftar Lowongan
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-500">Buat Lowongan Pekerjaan</span>
        </div>

        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs py-1">
          <Briefcase className="h-3 w-3 mr-1 text-teal-600" />
          Benchmark Standar Rekrutmen
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form */}
        <div className="lg:col-span-8">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/40">
              <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Definisi Posisi &amp; Profil Ideal
              </CardTitle>
              <p className="text-xs text-slate-500">
                Data ini menjadi acuan benchmark AI saat menghasilkan Fit-Gap Report dan radar kesesuaian kompetensi kandidat.
              </p>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Role Title */}
                <div className="space-y-2">
                  <Label htmlFor="role_title" className="text-xs font-bold text-slate-700">
                    Nama Posisi / Role Title <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="role_title"
                    placeholder="Contoh: Senior Frontend Engineer (React/Next.js)"
                    className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm focus:bg-white"
                    {...register("role_title", { required: "Role title wajib diisi" })}
                  />
                  {errors.role_title && (
                    <p className="text-xs text-rose-500 font-medium">{errors.role_title.message}</p>
                  )}
                </div>

                <Separator className="bg-slate-100" />

                {/* Expected Skills List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold text-slate-800">
                        Ekspektasi Kompetensi Skill ({fields.length} skill terdaftar)
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Pilih skill dan tentukan target level minimum (L1–L5) yang diharapkan perusahaan.
                      </p>
                    </div>
                  </div>

                  {fields.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Belum ada ekspektasi skill</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Tambahkan kompetensi dari standar B7 Taxonomy untuk mengukur kecocokan kandidat.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                        className="rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50 font-semibold text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" />
                        Tambah Ekspektasi Skill
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="border border-slate-200/80 rounded-2xl p-4 bg-white shadow-xs space-y-3 transition-all hover:border-slate-300"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {watch(`skills.${index}.skill_label`)}
                            </span>
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Hapus skill"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-xs font-semibold text-slate-600">
                              Ekspektasi Level Minimum:
                            </span>
                            <LevelRadio
                              value={watch(`skills.${index}.expected_level`) ?? 3}
                              onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                            />
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                        className="rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50 font-semibold text-xs mt-2"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" />
                        Tambah Skill Lainnya
                      </Button>
                    </div>
                  )}
                </div>

                <Separator className="bg-slate-100" />

                {/* Culture & Competency Expectations */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="culture_dimensions" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-teal-600" />
                      <span>Dimensi Kultur Perusahaan (Culture Fit)</span>
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      AI Gemini akan menganalisis gaya komunikasi dan inisiatif kandidat terhadap nilai kultur ini.
                    </p>
                    <Textarea
                      id="culture_dimensions"
                      placeholder="Contoh: Ownership tinggi, kolaborasi async-first, customer obsession, transparansi dan feedback jujur..."
                      rows={3}
                      className="rounded-xl bg-slate-50/50 border-slate-200 text-xs focus:bg-white resize-y"
                      {...register("culture_dimensions")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="competency_expectations" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-teal-600" />
                      <span>Ekspektasi Sikap &amp; Cara Kerja (Competency Narrative)</span>
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Karakteristik non-teknis seperti kemampuan kepemimpinan, pemecahan masalah di bawah tekanan, dsb.
                    </p>
                    <Textarea
                      id="competency_expectations"
                      placeholder="Contoh: Mampu memimpin diskusi teknis lintas tim, tenang menyelesaikan incident produksi, aktif mentoring junior engineer..."
                      rows={3}
                      className="rounded-xl bg-slate-50/50 border-slate-200 text-xs focus:bg-white resize-y"
                      {...register("competency_expectations")}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                )}

                <Separator className="bg-slate-100" />

                <div className="flex items-center justify-end gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate("/vacancies")}
                    className="rounded-xl text-xs font-semibold text-slate-600"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs h-10 px-5 shadow-sm"
                  >
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Simpan Lowongan Pekerjaan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Insights */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
              <HeartHandshake className="h-4 w-4 text-teal-600" />
              <span>Bagaimana Fit-Gap Engine Bekerja</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Setelah kandidat menyelesaikan wawancara, AI Engine membandingkan performa kandidat secara matematis terhadap lowongan ini:
            </p>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-800">Match Rate %:</strong> Dihitung berdasarkan gap antara level kandidat vs target level lowongan.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-800">Skill Radar Overlay:</strong> Memvisualisasikan keunggulan dan area gap dalam grafik poligon 5-axis.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-800">Narasi Kultur:</strong> AI memetakan respons kandidat ke nilai budaya spesifik yang Anda definisikan di atas.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
      />
    </div>
  );
}
