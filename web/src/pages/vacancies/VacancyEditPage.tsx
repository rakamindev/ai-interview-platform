import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Briefcase,
  Building2,
  Users,
  Settings,
  HeartHandshake,
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
    vacanciesApi.get(Number(id)).then((res) => {
      const v = res.data.vacancy;
      reset({
        role_title: v.role_title,
        culture_dimensions: v.culture_dimensions ?? "",
        competency_expectations: v.competency_expectations ?? "",
        skills: v.skills ?? [],
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    if (!data.role_title.trim()) {
      setError("Judul lowongan wajib diisi.");
      return;
    }
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menyimpan perubahan lowongan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="lg:col-span-8 h-96 rounded-3xl" />
          <Skeleton className="lg:col-span-4 h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
          <span className="text-xs font-medium text-slate-500">Edit Lowongan</span>
        </div>

        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs py-1">
          <Settings className="h-3 w-3 mr-1 text-slate-600" />
          ID: #{id}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/40">
              <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Edit Spesifikasi Lowongan
              </CardTitle>
              <p className="text-xs text-slate-500">
                Sesuaikan standar kompetensi dan dimensi budaya perusahaan untuk role ini.
              </p>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="role_title" className="text-xs font-bold text-slate-700">
                    Nama Posisi / Role Title <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="role_title"
                    className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm focus:bg-white"
                    {...register("role_title", { required: true })}
                  />
                </div>

                <Separator className="bg-slate-100" />

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-800">
                    Ekspektasi Kompetensi Skill ({fields.length} skill)
                  </Label>

                  {fields.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500 bg-slate-50/50">
                      Belum ada ekspektasi skill ditambahkan.
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
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    className="rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50 font-semibold text-xs mt-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" />
                    Tambah Ekspektasi Skill
                  </Button>
                </div>

                <Separator className="bg-slate-100" />

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="culture_dimensions" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-teal-600" />
                      <span>Dimensi Kultur Perusahaan</span>
                    </Label>
                    <Textarea
                      id="culture_dimensions"
                      rows={3}
                      className="rounded-xl bg-slate-50/50 border-slate-200 text-xs focus:bg-white resize-y"
                      {...register("culture_dimensions")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="competency_expectations" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-teal-600" />
                      <span>Ekspektasi Sikap &amp; Cara Kerja</span>
                    </Label>
                    <Textarea
                      id="competency_expectations"
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
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
              <HeartHandshake className="h-4 w-4 text-teal-600" />
              <span>Dampak Terhadap Fit-Gap Report</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Setiap kali asesor meminta perbandingan kandidat terhadap lowongan ini, AI Engine akan menggunakan parameter terbaru yang tersimpan di sini.
            </p>
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
