import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "./LevelRadio";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface CustomSkillFormProps {
  index: number;
  form: UseFormReturn<AssessmentFormValues>;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "What does L1 look like for this skill?",
  2: "What does L2 look like for this skill?",
  3: "What does L3 look like for this skill?",
  4: "What does L4 look like for this skill?",
  5: "What does L5 look like for this skill?",
};

const LEVEL_KEYS = [
  "l1_anchor",
  "l2_anchor",
  "l3_anchor",
  "l4_anchor",
  "l5_anchor",
] as const;

export default function CustomSkillForm({
  index,
  form,
}: CustomSkillFormProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  const expectedLevel = useWatch({
    control: form.control,
    name: `skills.${index}.expected_level`,
  });

  const skillErrors = errors.skills?.[index];

  const requiredText = (message: string) => ({
    validate: (value: string | undefined) =>
      !!value?.trim() || message,
  });

  return (
    <div className="space-y-3 pt-1">

      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.skill_label`}>
          Name <span className="text-destructive">*</span>
        </Label>

        <Input
          id={`skills.${index}.skill_label`}
          placeholder="e.g. Communication"
          aria-invalid={!!skillErrors?.skill_label}
          className={
            skillErrors?.skill_label
              ? "border-destructive focus-visible:ring-destructive"
              : ""
          }
          {...register(
            `skills.${index}.skill_label`,
            requiredText("Skill name is required")
          )}
        />

        {skillErrors?.skill_label?.message && (
          <p className="text-xs text-destructive">
            {skillErrors.skill_label.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.scope_include`}>
          What counts (scope include){" "}
          <span className="text-destructive">*</span>
        </Label>

        <Textarea
          id={`skills.${index}.scope_include`}
          placeholder="Clear technical explanation, stakeholder alignment, async written communication..."
          rows={2}
          aria-invalid={!!skillErrors?.scope_include}
          className={
            skillErrors?.scope_include
              ? "border-destructive focus-visible:ring-destructive"
              : ""
          }
          {...register(
            `skills.${index}.scope_include`,
            requiredText("Scope include is required")
          )}
        />

        {skillErrors?.scope_include?.message && (
          <p className="text-xs text-destructive">
            {skillErrors.scope_include.message}
          </p>
        )}
      </div>


      <div className="space-y-2">
        {LEVEL_KEYS.map((key, i) => {
          const level = i + 1;
          const fieldError = skillErrors?.[key];

          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`skills.${index}.${key}`}>
                L{level} anchor{" "}
                <span className="text-destructive">*</span>
              </Label>

              <Textarea
                id={`skills.${index}.${key}`}
                placeholder={LEVEL_PLACEHOLDERS[level]}
                rows={2}
                aria-invalid={!!fieldError}
                className={
                  fieldError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
                {...register(
                  `skills.${index}.${key}`,
                  requiredText(`L${level} anchor is required`)
                )}
              />

              {fieldError?.message && (
                <p className="text-xs text-destructive">
                  {fieldError.message}
                </p>
              )}
            </div>
          );
        })}
      </div>


      <div className="space-y-1.5">
        <Label>Expected level</Label>

        <LevelRadio
          value={expectedLevel ?? 3}
          onChange={(value) =>
            setValue(
              `skills.${index}.expected_level`,
              value,
              {
                shouldDirty: true,
              }
            )
          }
        />
      </div>
    </div>
  );
}