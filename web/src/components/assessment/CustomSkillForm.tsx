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

export default function CustomSkillForm({ index, form }: CustomSkillFormProps) {
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
          {...register(`skills.${index}.skill_label`, {
            required: "Skill name is required.",
          })}
        />
        {skillErrors?.skill_label && (
          <p className="text-xs text-destructive" role="alert">
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
          {...register(`skills.${index}.scope_include`, {
            required: "What counts is required.",
          })}
        />
        {skillErrors?.scope_include && (
          <p className="text-xs text-destructive" role="alert">
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
        ).map((key, i) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`skills.${index}.${key}`}>
              L{i + 1} anchor <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`skills.${index}.${key}`}
              placeholder={LEVEL_PLACEHOLDERS[i + 1]}
              rows={2}
              aria-invalid={!!skillErrors?.[key]}
              {...register(`skills.${index}.${key}`, {
                required: `L${i + 1} anchor is required.`,
              })}
            />
            {skillErrors?.[key] && (
              <p className="text-xs text-destructive" role="alert">
                {skillErrors[key].message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Expected level</Label>
        <LevelRadio
          value={expectedLevel ?? 3}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
        />
      </div>
    </div>
  );
}
