import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, Briefcase, Sparkles, Layers, BookOpen, AlertCircle } from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
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
    if (!data.skills || data.skills.length === 0) {
      setError("Mohon tambahkan minimal 1 target skill agar lowongan memiliki standar benchmark.");
      return;
    }
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

  const roleTitle = watch("role_title");
  const skills = watch("skills") || [];
  const isFormValid = Boolean(roleTitle?.trim() && skills.length > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-28 sm:pb-8">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          title="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Link to="/vacancies" className="hover:text-foreground">Vacancies</Link>
            <span>/</span>
            <span className="text-slate-900">New Vacancy</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Create Job Vacancy
          </h1>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to save vacancy</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Form Grid ── */}
      <form id="vacancy-new-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ── Left Column (2 cols on lg) ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Role Information */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900">
                1. Role Information
              </CardTitle>
              <CardDescription className="text-xs">
                Job title and benchmark position details
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="role_title" className="text-sm font-semibold text-slate-900">
                  Role Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role_title"
                  placeholder="e.g. Senior Frontend Engineer"
                  className="h-10 text-sm"
                  {...register("role_title", { required: true })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Expected Skills */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  2. Required Skills &amp; Benchmarks
                </CardTitle>
                <CardDescription className="text-xs">
                  Expected competency level for Fit/Gap analysis
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {fields.length} skill{fields.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {fields.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center space-y-3 bg-slate-50/40">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">No skill expectations added yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add skills to enable automatic scoring and gap calculation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-white shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">{watch(`skills.${index}.skill_label`)}</span>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-slate-400 hover:text-destructive p-1 rounded-md hover:bg-rose-50 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-medium text-muted-foreground">Expected level benchmark:</span>
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
                className="h-9 bg-white shadow-xs"
                onClick={() => setPickerOpen(true)}
              >
                <BookOpen className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Add Skill Benchmark
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: AI Narrative Context */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900">
                3. Culture &amp; Expectations (Optional)
              </CardTitle>
              <CardDescription className="text-xs">
                Context provided to AI when generating Fit/Gap narrative reports
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="culture_dimensions" className="text-sm font-semibold text-slate-900">
                  Company Culture Dimensions
                </Label>
                <Textarea
                  id="culture_dimensions"
                  placeholder="e.g. High ownership, fast-paced async communication, collaborative problem solving..."
                  rows={3}
                  className="text-sm"
                  {...register("culture_dimensions")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="competency_expectations" className="text-sm font-semibold text-slate-900">
                  General Competency Expectations
                </Label>
                <Textarea
                  id="competency_expectations"
                  placeholder="e.g. Strong technical leadership, pragmatic approach to architectural trade-offs..."
                  rows={3}
                  className="text-sm"
                  {...register("competency_expectations")}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Summary & Actions (1 col on lg) ── */}
        <div className="space-y-6">
          <Card className="border-slate-200/80 shadow-xs sticky top-20">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-primary" /> Vacancy Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Role Title</span>
                <p className="font-semibold text-slate-900 text-base">
                  {roleTitle?.trim() || <span className="text-muted-foreground font-normal italic">Untitled Vacancy</span>}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">
                  Benchmarked Skills ({skills.length})
                </span>
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No skills added yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {skills.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                        <span className="truncate pr-2 text-slate-700 font-medium">
                          {s.skill_label}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {LEVEL_LABELS[s.expected_level ?? 3]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop actions */}
              <div className="pt-4 border-t border-slate-100 hidden sm:flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-10 shadow-sm"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Vacancy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-slate-500 hover:text-slate-900"
                  onClick={() => navigate("/vacancies")}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </form>

      {/* ── Mobile sticky action bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex gap-2" style={{ bottom: "64px" }}>
        <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => navigate("/vacancies")}>
          Cancel
        </Button>
        <Button form="vacancy-new-form" type="submit" className="flex-1 h-10 bg-primary text-white font-semibold" disabled={!isFormValid || submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Vacancy
        </Button>
      </div>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
      />
    </div>
  );
}
