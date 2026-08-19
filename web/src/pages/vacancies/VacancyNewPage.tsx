import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, Info } from "lucide-react";
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
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const onSubmit = async (data: VacancyFormValues) => {
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80 transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <span className="text-sm text-muted-foreground">Vacancies</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Vacancy</span>
      </div>

      <Card className="shadow-lg border-primary/10 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-blue-500" />
        <CardHeader className="bg-muted/10 pb-8 border-b">
          <CardTitle className="text-2xl">Buat Lowongan Baru</CardTitle>
          <CardDescription>Definisikan kriteria posisi yang dibutuhkan untuk dicocokkan dengan assessment.</CardDescription>
        </CardHeader>
        
        <CardContent className="pt-8">
          <form id="vacancy-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="role_title" className="text-base font-semibold">
                Judul Peran (Role Title) <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="role_title" 
                placeholder="Misal: Senior Frontend Engineer" 
                className="h-11"
                {...register("role_title", { required: true })} 
              />
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <Info className="w-3 h-3 mr-1" /> Digunakan sebagai identitas utama lowongan ini.
              </p>
            </div>

            <Separator />

            {/* Expected skills */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Keahlian yang Diharapkan (Expected Skills)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3 flex items-center">
                  <Info className="w-3 h-3 mr-1" /> Tambahkan keahlian teknis atau soft-skills yang wajib dimiliki kandidat.
                </p>
              </div>

              {fields.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center bg-muted/20">
                  <div className="mx-auto w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Belum ada keahlian ditambahkan</p>
                  <p className="text-xs text-muted-foreground mb-4">Mulai dengan menambahkan keahlian pertama.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    Tambah Keahlian
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-3 bg-card shadow-sm group hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">{watch(`skills.${index}.skill_label`)}</span>
                        <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Level yang diharapkan:</span>
                        <LevelRadio
                          value={watch(`skills.${index}.expected_level`) ?? 3}
                          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                        />
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="w-full border-dashed mt-2">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Keahlian Lainnya
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="culture_dimensions" className="text-base font-semibold">Budaya Perusahaan</Label>
                <Textarea
                  id="culture_dimensions"
                  placeholder="Misal: Bekerja dengan ritme cepat, async-first, mengutamakan inisiatif..."
                  rows={4}
                  className="resize-none"
                  {...register("culture_dimensions")}
                />
                <p className="text-xs text-muted-foreground flex items-start mt-1">
                  <Info className="w-3 h-3 mr-1 mt-0.5 shrink-0" /> AI akan menggunakan info ini untuk mengevaluasi apakah kandidat cocok dengan budaya Anda.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="competency_expectations" className="text-base font-semibold">Ekspektasi Kompetensi</Label>
                <Textarea
                  id="competency_expectations"
                  placeholder="Misal: Komunikator yang handal, mampu memimpin tim lintas divisi..."
                  rows={4}
                  className="resize-none"
                  {...register("competency_expectations")}
                />
                <p className="text-xs text-muted-foreground flex items-start mt-1">
                  <Info className="w-3 h-3 mr-1 mt-0.5 shrink-0" /> Fokus pada gaya kerja, kepemimpinan, dan penyelesaian masalah.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t bg-muted/20 p-4 sm:p-6">
          <Button type="button" variant="ghost" onClick={() => navigate("/vacancies")} className="w-full sm:w-auto">Batal</Button>
          <Button type="submit" form="vacancy-form" disabled={submitting} className="w-full sm:w-auto min-w-[140px]">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {submitting ? "Menyimpan..." : "Simpan Lowongan"}
          </Button>
        </CardFooter>
      </Card>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
      />
    </div>
  );
}
