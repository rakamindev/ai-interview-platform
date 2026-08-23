import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import PageHeader from "@/components/PageHeader";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, X, Loader2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { VacancyFormSchema } from "@/schemas/forms";
import type { VacancyFormValues } from "@/schemas/forms";

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, watch } = useForm<VacancyFormValues>({
    resolver: zodResolver(VacancyFormSchema),
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: []
    }
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
        vacancy_skills_attributes: data.skills
      });
      navigate("/vacancies");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { errors?: { message?: string }[] } } };
      setError(err?.response?.data?.errors?.[0]?.message ?? m.vacancy_save_error());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto">
      <PageHeader
        title={m.vacancy_new()}
        description={m.vacancy_subtitle()}
        eyebrow={m.vacancy_title_label()}
        backTo="/vacancies"
        backLabel={m.common_back()}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="role_title">
            {m.vacancy_role_title()} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="role_title"
            placeholder={m.vacancy_role_placeholder()}
            {...register("role_title")}
          />
        </div>

        <Separator />

        {/* Expected skills */}
        <div className="space-y-3">
          <Label>{m.vacancy_expected_skills()}</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
              {m.vacancy_no_skills()}
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {watch(`skills.${index}.skill_label`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove skill"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {m.vacancy_expected_level_label()}
                    </span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                      idPrefix={field.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {m.vacancy_add_skill()}
          </Button>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions">{m.vacancy_company_culture()}</Label>
          <Textarea
            id="culture_dimensions"
            placeholder={m.vacancy_culture_placeholder()}
            rows={3}
            {...register("culture_dimensions")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">{m.vacancy_competency_expectations()}</Label>
          <Textarea
            id="competency_expectations"
            placeholder={m.vacancy_competency_placeholder()}
            rows={3}
            {...register("competency_expectations")}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>
            {m.vacancy_cancel()}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {m.vacancy_save()}
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) =>
          append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })
        }
      />
    </main>
  );
}
