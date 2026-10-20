import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, X, Loader2, Sparkles, AlertCircle } from "lucide-react";
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
    if (data.skills.length === 0) {
      setError("Please add at least one expected skill for this vacancy.");
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">New Vacancy</h1>
        <p className="text-sm text-muted-foreground">
          Define job role requirements, culture dimensions, and expected competencies.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Configuration */}
        <div className="space-y-2">
          <Label htmlFor="role_title" className="text-sm font-semibold text-foreground">
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="role_title"
            placeholder="e.g. Senior Frontend Engineer, Staff Backend Architect"
            className="text-sm h-10 max-w-2xl"
            {...register("role_title", { required: "Role title is required" })}
          />
          {errors.role_title && (
            <p className="text-xs text-destructive">{errors.role_title.message}</p>
          )}
        </div>

        {/* Expected Skills Section */}
        <div className="space-y-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Expected Skills
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Specify target competencies and baseline proficiency levels (L1–L5) required for this position.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Add from Taxonomy
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed p-12 text-center space-y-4 bg-muted/5">
              <div className="mx-auto w-12 h-12 border border-primary/20 bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No expected skills added yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Select predefined competencies from the standardized taxonomy database to evaluate candidates against.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Browse Taxonomy
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border bg-card p-6 md:p-7 space-y-4 transition-shadow"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <h3 className="font-bold text-base md:text-lg text-foreground truncate">
                        {watch(`skills.${index}.skill_label`)}
                      </h3>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border select-none shrink-0 border-primary/30 bg-primary/10 text-primary">
                        Taxonomy
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                      title="Remove skill"
                      aria-label="Remove skill"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        Expected Minimum Level:
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Required baseline proficiency rating for this job role
                      </span>
                    </div>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {fields.length > 0 && (
            <div className="flex justify-start pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add more from Taxonomy
              </Button>
            </div>
          )}
        </div>

        {/* Culture & Competencies Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <Label htmlFor="culture_dimensions" className="text-xs font-semibold text-foreground">
              Company Culture Dimensions <span className="text-muted-foreground font-normal">(Used in AI fit/gap narrative)</span>
            </Label>
            <Textarea
              id="culture_dimensions"
              placeholder="e.g. Ownership-driven, asynchronous-first, high autonomy, collaborative problem solving..."
              rows={4}
              className="text-xs leading-relaxed"
              {...register("culture_dimensions")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="competency_expectations" className="text-xs font-semibold text-foreground">
              Competency Expectations <span className="text-muted-foreground font-normal">(Used in AI fit/gap narrative)</span>
            </Label>
            <Textarea
              id="competency_expectations"
              placeholder="e.g. Strong technical communicator who can mentor juniors and align cross-functional product teams..."
              rows={4}
              className="text-xs leading-relaxed"
              {...register("competency_expectations")}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/vacancies")}
          >
            Cancel
          </Button>
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
