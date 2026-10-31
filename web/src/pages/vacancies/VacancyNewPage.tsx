import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-center gap-2 mb-6 sm:mb-8">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Link>
        <span className="text-sm sm:text-base text-muted-foreground">Vacancies</span>
        <span className="text-sm sm:text-base text-muted-foreground">/</span>
        <span className="text-sm sm:text-base font-medium">New Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
        <div className="space-y-1.5">
          <Label htmlFor="role_title" className="text-sm sm:text-base">Role title <span className="text-destructive">*</span></Label>
          <Input id="role_title" placeholder="Senior Frontend Engineer" {...register("role_title", { required: true })} className="text-sm sm:text-base" />
        </div>

        <Separator />

        {/* Expected skills */}
        <div className="space-y-3 sm:space-y-4">
          <Label className="text-sm sm:text-base font-medium">Expected skills</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-6 sm:p-8 text-center text-sm sm:text-base text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base font-medium">{watch(`skills.${index}.skill_label`)}</span>
                    <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Expected level:</span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill expectation
          </Button>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions" className="text-sm sm:text-base">Company culture (used in AI narrative)</Label>
          <Textarea
            id="culture_dimensions"
            placeholder="Ownership-driven, async-first, direct feedback culture..."
            rows={3}
            {...register("culture_dimensions")}
            className="text-sm sm:text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations" className="text-sm sm:text-base">Competency expectations (used in AI narrative)</Label>
          <Textarea
            id="competency_expectations"
            placeholder="Strong communicator who can align cross-functional teams..."
            rows={3}
            {...register("competency_expectations")}
            className="text-sm sm:text-base"
          />
        </div>

        {error && <p className="text-sm sm:text-base text-destructive">{error}</p>}

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
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
