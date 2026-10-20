import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SkillPicker from "@/components/assessment/SkillPicker";
import VacancySkillItem from "@/components/vacancies/VacancySkillItem";
import ApiErrorList from "@/components/ApiErrorList";
import { useToast } from "@/components/ui/toast";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import type { VacancySkill } from "@/types";
import { apiErrorMessages } from "@/utils/apiErrors";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<VacancyFormValues>({
    defaultValues: { role_title: "", culture_dimensions: "", competency_expectations: "", skills: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const onSubmit = async (data: VacancyFormValues) => {
    setServerErrors([]);
    setSubmitting(true);
    try {
      await vacanciesApi.create({
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
        status: "active",
      });
      toast.success("Vacancy created.");
      navigate("/vacancies");
    } catch (e: any) {
      setServerErrors(apiErrorMessages(e, "Failed to save vacancy."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/vacancies" className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowLeft className="h-4 w-4" />
          Vacancies
      </Link>

      <div className="space-y-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Create a vacancy</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Add the skills and expectations used to compare candidates for this role.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="overflow-hidden rounded-xl border bg-card">
        <section aria-labelledby="vacancy-role-heading" className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 id="vacancy-role-heading" className="font-semibold">Role details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start with the title candidates will be compared against.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role_title">Role title <span className="text-destructive">*</span></Label>
            <Input id="role_title" aria-invalid={!!errors.role_title} aria-describedby={errors.role_title ? "role-title-error" : undefined} placeholder="Senior Frontend Engineer" {...register("role_title", { required: "Role title is required" })} />
            {errors.role_title && <p id="role-title-error" className="text-sm text-destructive">{errors.role_title.message}</p>}
          </div>
        </section>

        <section aria-labelledby="vacancy-skills-heading" className="space-y-4 border-t p-5 sm:p-6">
          <div>
            <h2 id="vacancy-skills-heading" className="font-semibold">Expected skills</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose skills and set the level expected for this role.</p>
          </div>

          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
              <p className="text-sm font-medium">No skills added</p>
              <p className="mt-1 text-sm text-muted-foreground">Add at least one skill to describe this role.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <VacancySkillItem
                  key={field.id}
                  skill={watch(`skills.${index}`)}
                  onLevelChange={(level) => setValue(`skills.${index}.expected_level`, level)}
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
          )}

          <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus /> Add skill
          </Button>
        </section>

        <section aria-labelledby="vacancy-context-heading" className="space-y-5 border-t p-5 sm:p-6">
          <div>
            <h2 id="vacancy-context-heading" className="font-semibold">Role context</h2>
            <p className="mt-1 text-sm text-muted-foreground">Optional details used to add context to candidate comparisons.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="culture_dimensions">Company culture</Label>
              <Textarea
                id="culture_dimensions"
                placeholder="Ownership-driven, async-first, direct feedback culture..."
                rows={4}
                {...register("culture_dimensions")}
              />
              <p className="text-sm text-muted-foreground">Used in the culture-fit summary.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="competency_expectations">Competency expectations</Label>
              <Textarea
                id="competency_expectations"
                placeholder="Strong communicator who can align cross-functional teams..."
                rows={4}
                {...register("competency_expectations")}
              />
              <p className="text-sm text-muted-foreground">Describe behaviors that matter in this role.</p>
            </div>
          </div>
        </section>

        <div className="space-y-4 border-t bg-muted/20 p-5 sm:px-6">
          <ApiErrorList errors={serverErrors} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
            <Button className="w-full px-5 sm:w-auto" type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating vacancy..." : "Create vacancy"}
            </Button>
          </div>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(_, taxonomy) => append({
          skill_id: taxonomy.skill_id,
          skill_label: taxonomy.skill_label,
          expected_level: 3,
          l1_anchor: taxonomy.l1_anchor,
          l2_anchor: taxonomy.l2_anchor,
          l3_anchor: taxonomy.l3_anchor,
          l4_anchor: taxonomy.l4_anchor,
          l5_anchor: taxonomy.l5_anchor,
        })}
      />
    </div>
  );
}
