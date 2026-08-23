import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "./LevelRadio";
import { m } from "@/paraglide/messages.js";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface CustomSkillFormProps {
  index: number;
  form: UseFormReturn<AssessmentFormValues>;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: m.custom_skill_anchor_placeholder_l1(),
  2: m.custom_skill_anchor_placeholder_l2(),
  3: m.custom_skill_anchor_placeholder_l3(),
  4: m.custom_skill_anchor_placeholder_l4(),
  5: m.custom_skill_anchor_placeholder_l5(),
};

export default function CustomSkillForm({ index, form }: CustomSkillFormProps) {
  const { register, setValue, formState: { errors } } = form;
  const expectedLevel = useWatch({ control: form.control, name: `skills.${index}.expected_level` });

  return (
    <div className="space-y-3 pt-1">
      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.skill_label`}>
          {m.custom_skill_name()} <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`skills.${index}.skill_label`}
          placeholder={m.custom_skill_name_placeholder()}
          {...register(`skills.${index}.skill_label`, { required: true })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.scope_include`}>
          {m.custom_skill_scope_include()} <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id={`skills.${index}.scope_include`}
          placeholder={m.custom_skill_scope_placeholder()}
          rows={2}
          {...register(`skills.${index}.scope_include`, { required: true })}
        />
      </div>

      <div className="space-y-2">
        {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((key, i) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`skills.${index}.${key}`}>
              {m.custom_skill_anchor({ i: String(i + 1) })} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`skills.${index}.${key}`}
              placeholder={LEVEL_PLACEHOLDERS[i + 1]}
              rows={2}
              {...register(`skills.${index}.${key}`, { required: true })}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>{m.custom_skill_expected_level()}</Label>
        <LevelRadio
          value={expectedLevel ?? 3}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
        />
      </div>
    </div>
  );
}
