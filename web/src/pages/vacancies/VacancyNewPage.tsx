import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import useVacancy from "./hooks/useVacancy";
import { UnsavedConfirmationDialog } from "@/components/ui/unsaved-comfirmation-dialog";

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
    clearErrors,
    onSubmit,
    submitting,
    errorResponse,
    hasUnsavedChanges,
  } = useVacancy();

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link
          to="/vacancies"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Vacancies</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="role_title">
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="role_title"
            placeholder="Senior Frontend Engineer"
            {...register("role_title", { required: "Role title is required" })}
          />
          {errors.role_title && (
            <p className="text-xs text-destructive">
              {errors.role_title.message}
            </p>
          )}
        </div>

        <Separator />

        {/* Expected skills */}
        <div className="space-y-3">
          <Label>
            Expected skills <span className="text-destructive">*</span>
          </Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
              No skills added yet.
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
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Expected level:
                    </span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) =>
                        setValue(`skills.${index}.expected_level`, v)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {errors.skills && (
            <p className="text-xs text-destructive">{errors.skills.message}</p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill expectation
          </Button>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions">
            Company culture (used in AI narrative)
          </Label>
          <Textarea
            id="culture_dimensions"
            placeholder="Ownership-driven, async-first, direct feedback culture..."
            rows={3}
            {...register("culture_dimensions", {
              required: "Company culture is required",
            })}
          />
          {errors.culture_dimensions && (
            <p className="text-xs text-destructive">
              {errors.culture_dimensions.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">
            Competency expectations (used in AI narrative)
          </Label>
          <Textarea
            id="competency_expectations"
            placeholder="Strong communicator who can align cross-functional teams..."
            rows={3}
            {...register("competency_expectations", {
              required: "Competency expectations is required",
            })}
          />
          {errors.competency_expectations && (
            <p className="text-xs text-destructive">
              {errors.competency_expectations.message}
            </p>
          )}
        </div>

        {errorResponse && (
          <p className="text-sm text-destructive">{errorResponse}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (hasUnsavedChanges) {
                setCancelDialogOpen(true);
                return;
              }
              navigate("/vacancies");
            }}
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
        onSelect={(s) => {
          append({
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            expected_level: 3,
          });
          clearErrors("skills");
        }}
      />

      <UnsavedConfirmationDialog
        onConfirm={() => navigate("/assessments")}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
      />
    </div>
  );
}
