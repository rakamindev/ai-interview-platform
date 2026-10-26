import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2, AlertCircle, Briefcase, Zap, Sparkles, Building2, Target } from "lucide-react";
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Breadcrumb & Header ── */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <Link
            to="/vacancies"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-500/20 bg-white/80 hover:bg-emerald-50/80 text-emerald-700 shadow-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Vacancies</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-slate-500 font-medium">New Vacancy</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create Job Vacancy Profile</h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-500/20 text-xs font-semibold text-emerald-700">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          AI Fit-Gap Calibration
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Basic Info Card ── */}
        <div className="relative rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.10)] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Position Details</h2>
              <p className="text-xs text-slate-500">Provide the hiring job title for this vacancy profile.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="role_title" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Role Title <span className="text-emerald-500">*</span>
            </label>
            <input
              id="role_title"
              placeholder="e.g. Senior Frontend Engineer, Staff Backend Architect"
              {...register("role_title", { required: true })}
              className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all hover:border-emerald-300"
            />
          </div>
        </div>

        {/* ── Skills Section ── */}
        <div className="relative rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 sm:p-8 space-y-5 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.10)] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-500" />

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Expected Competencies</h2>
                <p className="text-xs text-slate-500">Define required skills and minimum competency benchmark levels.</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {fields.length} {fields.length === 1 ? "Requirement" : "Requirements"}
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed border-emerald-500/20 rounded-2xl p-8 text-center space-y-3 bg-emerald-50/20">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">No expected skills added yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Add target skills and benchmark expectations to calculate automated Fit-Gap matching scores.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Skill Expectation
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-2xl border border-emerald-500/20 bg-white p-4 space-y-3 shadow-sm hover:border-emerald-400/50 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{watch(`skills.${index}.skill_label`)}</span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-600">Required Benchmark Level:</span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-50/50 hover:bg-emerald-100/60 text-xs font-semibold text-emerald-800 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" /> Add Another Skill Expectation
              </button>
            </div>
          )}
        </div>

        {/* ── Culture & Competency Card ── */}
        <div className="relative rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.10)] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Culture & Competency Narratives</h2>
              <p className="text-xs text-slate-500">Used by Gemini AI to produce qualitative fit evaluations.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="culture_dimensions" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Company Culture <span className="text-slate-400 font-normal lowercase">(used in AI narrative generation)</span>
            </label>
            <textarea
              id="culture_dimensions"
              placeholder="e.g. Ownership-driven, async-first, direct candor, psychological safety..."
              rows={3}
              {...register("culture_dimensions")}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all hover:border-emerald-300 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="competency_expectations" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Competency Expectations <span className="text-slate-400 font-normal lowercase">(used in AI narrative generation)</span>
            </label>
            <textarea
              id="competency_expectations"
              placeholder="e.g. Exceptional technical communicator who aligns cross-functional engineering and product stakeholders..."
              rows={3}
              {...register("competency_expectations")}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all hover:border-emerald-300 resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/vacancies")}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.45)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Vacancy Profile →
          </button>
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
