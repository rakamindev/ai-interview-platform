import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AnimatePresence, m } from "motion/react";
import { Notice } from "@/components/motion/Notice";
import FormPageLayout from "@/components/layout/FormPageLayout";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { Plus, X, Loader2, Sparkles } from "lucide-react";
import type { VacancySkill } from "@/types";

export interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

interface VacancyFormProps {
  initialValues?: Partial<VacancyFormValues>;
  onSubmit: (values: VacancyFormValues) => Promise<void>;
  submitting: boolean;
  error?: string | null;
  mode: "create" | "edit";
  title: string;
  description?: string;
}

export default function VacancyForm({
  initialValues,
  onSubmit,
  submitting,
  error,
  mode,
  title,
  description,
}: VacancyFormProps) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: initialValues?.role_title ?? "",
      culture_dimensions: initialValues?.culture_dimensions ?? "",
      competency_expectations: initialValues?.competency_expectations ?? "",
      skills: initialValues?.skills ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    if (initialValues) {
      reset({
        role_title: initialValues.role_title ?? "",
        culture_dimensions: initialValues.culture_dimensions ?? "",
        competency_expectations: initialValues.competency_expectations ?? "",
        skills: initialValues.skills ?? [],
      });
    }
  }, [initialValues, reset]);

  return (
    <FormPageLayout
      backTo="/vacancies"
      backLabel="Vacancies"
      title={title}
      description={description}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Role Title */}
            <div className="space-y-1.5">
              <Label htmlFor="role_title" className="font-medium">
                Role title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role_title"
                placeholder="e.g. Senior Frontend Engineer"
                {...register("role_title", { required: "Role title is required" })}
                className={errors.role_title ? "border-destructive" : ""}
              />
              {errors.role_title && (
                <p role="alert" className="text-xs text-red-700 mt-1">{errors.role_title.message}</p>
              )}
            </div>

            <Separator />

            {/* Expected Skills */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium text-sm">Expected skills</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skills required for this role and their benchmark proficiency levels (L1–L5).
                  </p>
                </div>
              </div>

              {fields.length === 0 ? (
                <div className="border border-dashed rounded-lg p-6 text-center space-y-2 bg-muted/20">
                  <p className="text-sm text-muted-foreground">No skills added yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add skill from taxonomy
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Rows slide in on add and collapse on remove, so the list never jumps under the cursor */}
                  <AnimatePresence initial={false}>
                  {fields.map((field, index) => (
                    <m.div
                      key={field.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                      className="border rounded-lg p-3.5 space-y-2.5 bg-card overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium break-words min-w-0">
                          {watch(`skills.${index}.skill_label`)}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-muted-foreground hover:text-red-700 hover:bg-red-50 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-md transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Remove ${watch(`skills.${index}.skill_label`)}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-xs text-muted-foreground">Required minimum level:</span>
                        <LevelRadio
                          name={`skill-${index}`}
                          value={watch(`skills.${index}.expected_level`) ?? 3}
                          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                        />
                      </div>
                    </m.div>
                  ))}
                  </AnimatePresence>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    className="mt-1"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add another skill
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Company Culture */}
            <div className="space-y-1.5">
              <Label htmlFor="culture_dimensions" className="font-medium">
                Company culture <span className="text-xs text-muted-foreground font-normal">(used in the fit/gap narrative)</span>
              </Label>
              <Textarea
                id="culture_dimensions"
                placeholder="e.g. Ownership-driven, async-first, direct feedback culture, collaborative problem solving..."
                rows={3}
                {...register("culture_dimensions")}
                className="resize-y"
              />
            </div>

            {/* Competency Expectations */}
            <div className="space-y-1.5">
              <Label htmlFor="competency_expectations" className="font-medium">
                Competency expectations <span className="text-xs text-muted-foreground font-normal">(used in the fit/gap narrative)</span>
              </Label>
              <Textarea
                id="competency_expectations"
                placeholder="e.g. Strong communicator who can articulate architectural trade-offs to product stakeholders..."
                rows={3}
                {...register("competency_expectations")}
                className="resize-y"
              />
            </div>

            {/* Error Message */}
            <Notice show={!!error}>
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-red-800">
                {error}
              </div>
            </Notice>

            {/* Footer Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/vacancies")}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "edit" ? "Save changes" : "Create vacancy"}
              </Button>
            </div>
          </form>
          {/* Skill Picker Dialog */}
          <SkillPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(s) =>
              append({
                skill_id: s.skill_id,
                skill_label: s.skill_label,
                expected_level: 3,
              })
            }
          />
        </FormPageLayout>
      );
    }
