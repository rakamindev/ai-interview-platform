import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RoleTitleField from "@/components/vacancies/RoleTitleField";
import LocationField from "@/components/vacancies/LocationField";
import SalaryInput from "@/components/vacancies/SalaryInput";
import { CUSTOM_ROLE_VALUE } from "@/utils/roleTitles";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import type { VacancySkill } from "@/types";
import { getLevelLabel, getLevelDescriptionId } from "@/utils/constants";

interface VacancyFormValues {
  role_title: string;
  role_title_custom?: string;
  culture_dimensions: string;
  competency_expectations: string;
  location: string;
  experience_level: "" | "intern" | "associate" | "mid" | "senior" | "lead";
  experience_years_min: string;
  experience_years_max: string;
  work_arrangement: "" | "onsite" | "hybrid" | "remote";
  employment_type: "" | "full_time" | "contract" | "internship";
  minimum_education: string;
  salary_min: string;
  salary_max: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, setError: setFieldError, watch, formState: { errors } } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "", culture_dimensions: "", competency_expectations: "", location: "", experience_level: "", experience_years_min: "", experience_years_max: "",
      work_arrangement: "", employment_type: "", minimum_education: "", salary_min: "", salary_max: "", skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });
  const getCounterClass = (value: string = "") => value.length > 500 ? "text-destructive" : value.length >= 450 ? "text-amber-600" : "text-muted-foreground";
  const validateSalaryMax = (value: string) => !value || !watch("salary_min") || Number(value) >= Number(watch("salary_min")) || "Maximum salary must be greater than or equal to minimum salary.";

  const onSubmit = async (data: VacancyFormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const roleTitle = data.role_title === CUSTOM_ROLE_VALUE ? data.role_title_custom?.trim() : data.role_title;
      if (!roleTitle) { setFieldError("role_title", { type: "required", message: "Choose or enter a role title." }); setSubmitting(false); return; }
      await vacanciesApi.create({
        role_title: roleTitle,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        location: data.location.trim() || undefined,
        experience_level: data.experience_level || undefined,
        experience_years_min: data.experience_years_min === "" ? undefined : Number(data.experience_years_min),
        experience_years_max: data.experience_years_max === "" ? undefined : Number(data.experience_years_max),
        work_arrangement: data.work_arrangement || undefined,
        employment_type: data.employment_type || undefined,
        minimum_education: data.minimum_education.trim() || undefined,
        salary_min: data.salary_min === "" ? undefined : Number(data.salary_min),
        salary_max: data.salary_max === "" ? undefined : Number(data.salary_max),
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      const apiErrors = e?.response?.data?.errors ?? [];
      const salaryError = apiErrors.find((item: any) => ["salary_min", "salary_max"].includes(item?.field) || /salary (min|max)/i.test(item?.message ?? ""));
      if (salaryError) {
        const field = (salaryError.field ?? (/salary min/i.test(salaryError.message) ? "salary_min" : "salary_max")) as "salary_min" | "salary_max";
        setFieldError(field, { type: "server", message: salaryError.message });
      } else {
        setSubmitError(apiErrors[0]?.message ?? "Failed to save vacancy.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Vacancies</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <RoleTitleField register={register as any} setValue={setValue as any} watch={watch as any} error={errors.role_title?.message} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="experience_level">Experience level</Label><select id="experience_level" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("experience_level")}><option value="">Not specified</option><option value="intern">Intern</option><option value="associate">Associate</option><option value="mid">Mid-level</option><option value="senior">Senior</option><option value="lead">Lead</option></select></div>
          <div><Label htmlFor="experience_years_min">Experience from (years)</Label><Input id="experience_years_min" type="number" min="0" placeholder="0" {...register("experience_years_min")} /></div>
          <div><Label htmlFor="experience_years_max">Experience to (years)</Label><Input id="experience_years_max" type="number" min="0" placeholder="-" {...register("experience_years_max")} /></div>
        </div>

        <Separator />

        <section className="space-y-4">
          <LocationField register={register as any} setValue={setValue as any} watch={watch as any} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="work_arrangement">Work arrangement</Label><select id="work_arrangement" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("work_arrangement")}><option value="">Not specified</option><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
            <div><Label htmlFor="employment_type">Employment type</Label><select id="employment_type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("employment_type")}><option value="">Not specified</option><option value="full_time">Full-time</option><option value="contract">Contract</option><option value="internship">Internship</option></select></div>
          </div>
          <div><Label htmlFor="minimum_education">Minimum education</Label><select id="minimum_education" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("minimum_education")}><option value="">Not specified</option><option value="No formal education required">No formal education required</option><option value="High school">High school</option><option value="Associate">Associate</option><option value="Diploma">Diploma</option><option value="Bachelor's degree">Bachelor&apos;s degree</option><option value="Master's degree">Master&apos;s degree</option><option value="Doctorate">Doctorate</option></select></div>
        </section>

        {/* Expected skills */}
        <div className="space-y-3">
          <Label>Expected skills</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                    <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Expected level:</span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                      labelFn={getLevelLabel} descriptionFn={getLevelDescriptionId}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill expectation
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SalaryInput field="salary_min" label="Minimum salary" placeholder="0" register={register as any} setValue={setValue as any} watch={watch as any} error={errors.salary_min?.message} />
          <SalaryInput field="salary_max" label="Maximum salary" placeholder="-" register={register as any} setValue={setValue as any} watch={watch as any} error={errors.salary_max?.message} validate={validateSalaryMax} />
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions">Company culture (used in AI narrative)</Label>
          <p className="text-xs text-muted-foreground">Describe the culture candidates should be evaluated against. Example: ownership-driven, async-first, direct feedback. This is context for AI-generated fit/gap narratives, not an instruction. Maximum 500 characters.</p>
          <Textarea
            id="culture_dimensions"
            placeholder="Ownership-driven, async-first, direct feedback culture..."
            rows={3}
            aria-invalid={Boolean(errors.culture_dimensions)}
            className={errors.culture_dimensions ? "border-destructive focus-visible:ring-destructive" : undefined}
            {...register("culture_dimensions", { maxLength: { value: 500, message: "Use 500 characters or fewer." } })}
          />
          <p className={`text-xs ${getCounterClass(watch("culture_dimensions"))}`}>{watch("culture_dimensions")?.length ?? 0}/500 characters</p>
          {errors.culture_dimensions && <p role="alert" className="text-xs text-destructive">{errors.culture_dimensions.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">Competency expectations (used in AI narrative)</Label>
          <p className="text-xs text-muted-foreground">Describe the competencies expected for this role. Example: strong communicator who can align cross-functional teams. This is context for AI-generated fit/gap narratives, not an instruction. Maximum 500 characters.</p>
          <Textarea
            id="competency_expectations"
            placeholder="Strong communicator who can align cross-functional teams..."
            rows={3}
            aria-invalid={Boolean(errors.competency_expectations)}
            className={errors.competency_expectations ? "border-destructive focus-visible:ring-destructive" : undefined}
            {...register("competency_expectations", { maxLength: { value: 500, message: "Use 500 characters or fewer." } })}
          />
          <p className={`text-xs ${getCounterClass(watch("competency_expectations"))}`}>{watch("competency_expectations")?.length ?? 0}/500 characters</p>
          {errors.competency_expectations && <p role="alert" className="text-xs text-destructive">{errors.competency_expectations.message}</p>}
        </div>

        {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Vacancy
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
