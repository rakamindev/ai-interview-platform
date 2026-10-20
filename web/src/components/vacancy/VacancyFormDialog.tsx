import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacancySchema } from "@/schemas/resources";
import { vacanciesApi } from "@/services/vacancies";
import { showRequestError } from "@/lib/requestToast";
import { Loader2, Plus, X } from "lucide-react";
import type { Vacancy, VacancySkill } from "@/types";

export interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

interface VacancyFormDialogProps {
  mode: "create" | "edit";
  vacancyId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (vacancy: Vacancy) => void;
}

const defaultValues: VacancyFormValues = {
  role_title: "",
  culture_dimensions: "",
  competency_expectations: "",
  skills: [],
};

export default function VacancyFormDialog({
  mode,
  vacancyId,
  open,
  onOpenChange,
  onSaved,
}: VacancyFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const form = useForm<VacancyFormValues>({ defaultValues });
  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      reset(defaultValues);
      setFormError(null);
      return;
    }
    if (!vacancyId) return;

    setLoading(true);
    vacanciesApi
      .get(vacancyId)
      .then((res) => {
        const vacancy = res.data.vacancy;
        reset({
          role_title: vacancy.role_title,
          culture_dimensions: vacancy.culture_dimensions ?? "",
          competency_expectations: vacancy.competency_expectations ?? "",
          skills: vacancy.skills ?? [],
        });
      })
      .catch((error) => showRequestError(error, "Couldn’t load this vacancy."))
      .finally(() => setLoading(false));
  }, [mode, open, reset, vacancyId]);

  const onSubmit = async (data: VacancyFormValues) => {
    setFormError(null);
    const parsed = vacancySchema.safeParse({
      role_title: data.role_title,
      culture_dimensions: data.culture_dimensions,
      competency_expectations: data.competency_expectations,
      skills: data.skills.map((skill) => ({
        skill_label: skill.skill_label ?? "",
        expected_level: skill.expected_level ?? 3,
      })),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the vacancy fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      };
      const response =
        mode === "create"
          ? await vacanciesApi.create(payload)
          : await vacanciesApi.update(vacancyId!, payload);
      onSaved(response.data.vacancy);
      toast.success(
        mode === "create" ? "Vacancy created." : "Vacancy updated.",
      );
      onOpenChange(false);
    } catch (error) {
      showRequestError(
        error,
        mode === "create"
          ? "Couldn’t create vacancy."
          : "Couldn’t update vacancy.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-5 text-left sm:px-7">
          <DialogTitle>
            {mode === "create" ? "Create vacancy" : "Edit vacancy"}
          </DialogTitle>
          <DialogDescription>
            Define the role requirements used by fit/gap analysis and AI
            narrative generation.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 px-5 py-10 sm:px-7">
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : (
          <>
            <form
              id="vacancy-form"
              onSubmit={handleSubmit(onSubmit, () => toast.error("Role title is required"))}
              className="space-y-6 px-5"
            >
              <div className="space-y-2">
                <Label htmlFor="vacancy-role-title">
                  Role title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vacancy-role-title"
                  placeholder="e.g. Senior Frontend Engineer"
                  aria-invalid={errors.role_title ? true : undefined}
                  aria-describedby={errors.role_title ? "vacancy-role-title-error" : undefined}
                  {...register("role_title", { required: "Role title is required" })}
                />
                {errors.role_title && <p id="vacancy-role-title-error" className="text-xs text-destructive">{errors.role_title.message}</p>}
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Expected skills</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set the minimum level required for this role.
                  </p>
                  {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
                </div>
                {fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No skills added yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="rounded-xl border border-border/80 bg-muted/20 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium">
                            {watch(`skills.${index}.skill_label`) ||
                              `Skill ${index + 1}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            aria-label={`Remove ${watch(`skills.${index}.skill_label`) || `skill ${index + 1}`}`}
                            onClick={() => remove(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-3 space-y-2">
                          <Label>Expected level</Label>
                          <LevelRadio
                            name={`vacancy-skill-${field.id}`}
                            label={`Expected level for ${watch(`skills.${index}.skill_label`) || `skill ${index + 1}`}`}
                            value={watch(`skills.${index}.expected_level`) ?? 3}
                            onChange={(value) =>
                              setValue(`skills.${index}.expected_level`, value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Add skill expectation
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="culture-dimensions">
                  Company culture{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="culture-dimensions"
                  placeholder="e.g. Ownership-driven, async-first, direct feedback culture..."
                  rows={3}
                  {...register("culture_dimensions")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="competency-expectations">
                  Competency expectations{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="competency-expectations"
                  placeholder="e.g. Strong communicator who aligns cross-functional teams..."
                  rows={3}
                  {...register("competency_expectations")}
                />
              </div>
            </form>
            <DialogFooter className="sticky bottom-0 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="vacancy-form" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create vacancy" : "Save changes"}
              </Button>
            </DialogFooter>
          </>
        )}
        <SkillPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(skill) =>
            append({
              skill_id: skill.skill_id,
              skill_label: skill.skill_label,
              expected_level: 3,
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
