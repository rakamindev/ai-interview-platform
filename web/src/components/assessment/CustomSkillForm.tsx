import {
  UseFormReturn,
  useFormState,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "./LevelRadio";
import { assessmentSchema } from "@/pages/assessments/assessmentSchema";
import { cn } from "@/lib/utils";

interface CustomSkillFormProps {
  index: number;
  form: UseFormReturn<z.infer<typeof assessmentSchema>>;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "What does L1 look like for this skill?",
  2: "What does L2 look like for this skill?",
  3: "What does L3 look like for this skill?",
  4: "What does L4 look like for this skill?",
  5: "What does L5 look like for this skill?",
};

export default function CustomSkillForm({
  index,
  form,
}: CustomSkillFormProps) {
  const { register, setValue, control } = form;

  const { errors } = useFormState({
    control,
  });

  const expectedLevel = useWatch({
    control,
    name: `skills.${index}.expected_level`,
  });

  const skillErrors = errors.skills?.[index];

  return (
    <div className="space-y-3 pt-1">
      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.skill_label`}>
          Name <span className="text-destructive">*</span>
        </Label>

        <Input
          id={`skills.${index}.skill_label`}
          placeholder="e.g. Communication"
          error={!!skillErrors?.skill_label}
          maxLength={128}
          {...register(`skills.${index}.skill_label`)}
        />

        {skillErrors?.skill_label && (
          <p className="text-sm font-medium text-destructive">
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
          className={cn(
            skillErrors?.scope_include &&
            "border-destructive focus-visible:ring-destructive"
          )}
          {...register(`skills.${index}.scope_include`)}
        />

        {skillErrors?.scope_include && (
          <p className="text-sm font-medium text-destructive">
            {skillErrors.scope_include.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {(
          [
            "l1_anchor",
            "l2_anchor",
            "l3_anchor",
            "l4_anchor",
            "l5_anchor",
          ] as const
        ).map((key, i) => {
          const fieldError = skillErrors?.[key];

          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`skills.${index}.${key}`}>
                L{i + 1} anchor{" "}
                <span className="text-destructive">*</span>
              </Label>

              <Textarea
                id={`skills.${index}.${key}`}
                placeholder={LEVEL_PLACEHOLDERS[i + 1]}
                rows={2}
                className={cn(
                  fieldError &&
                  "border-destructive focus-visible:ring-destructive"
                )}
                {...register(`skills.${index}.${key}`)}
              />

              {fieldError && (
                <p className="text-sm font-medium text-destructive">
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
            setValue(`skills.${index}.expected_level`, value)
          }
        />
      </div>
    </div>
  );
}