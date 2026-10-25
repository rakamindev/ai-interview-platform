import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import SkillPicker from "@/components/assessment/SkillPicker";
import VacancySkillCard, { type VacancyFormValues } from "@/components/vacancy/VacancySkillCard";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });
  const { register, handleSubmit, control, formState: { errors } } = form;

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
        <div className="space-y-1.5">
          <Label htmlFor="role_title">Role title <span className="text-destructive">*</span></Label>
          <Input id="role_title" placeholder="Senior Frontend Engineer" {...register("role_title", { required: true })} />
        </div>

        <Separator />

        {/* Expected skills */}
        <div className="space-y-3">
          <Label>Expected skills</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => <VacancySkillCard key={field.id} index={index} form={form} onRemove={() => remove(index)} />)}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill expectation
          </Button>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions">Company culture (used in AI narrative)</Label>
          <Textarea
            id="culture_dimensions"
            placeholder="Ownership-driven, async-first, direct feedback culture..."
            rows={3}
            {...register("culture_dimensions")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">Competency expectations (used in AI narrative)</Label>
          <Textarea
            id="competency_expectations"
            placeholder="Strong communicator who can align cross-functional teams..."
            rows={3}
            {...register("competency_expectations")}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

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
