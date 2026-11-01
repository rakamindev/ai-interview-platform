import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FieldError from "@/components/FieldError";
import LevelRadio from "./LevelRadio";
import { MAX_TEXT_FIELD_LENGTH, requiredText } from "@/utils/validation";
import type { AssessmentSkill } from "@/types";

interface CustomSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (skill: Partial<AssessmentSkill>) => void;
  skill?: Partial<AssessmentSkill>;
}

type CustomSkillValues = Required<
  Pick<
    AssessmentSkill,
    | "skill_label"
    | "scope_include"
    | "l1_anchor"
    | "l2_anchor"
    | "l3_anchor"
    | "l4_anchor"
    | "l5_anchor"
    | "expected_level"
  >
>;

const EMPTY_SKILL: CustomSkillValues = {
  skill_label: "",
  scope_include: "",
  l1_anchor: "",
  l2_anchor: "",
  l3_anchor: "",
  l4_anchor: "",
  l5_anchor: "",
  expected_level: 3,
};

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "What does L1 look like for this skill?",
  2: "What does L2 look like for this skill?",
  3: "What does L3 look like for this skill?",
  4: "What does L4 look like for this skill?",
  5: "What does L5 look like for this skill?",
};

function valuesFor(skill?: Partial<AssessmentSkill>): CustomSkillValues {
  if (!skill) return EMPTY_SKILL;

  return {
    skill_label: skill.skill_label ?? "",
    scope_include: skill.scope_include ?? "",
    l1_anchor: skill.l1_anchor ?? "",
    l2_anchor: skill.l2_anchor ?? "",
    l3_anchor: skill.l3_anchor ?? "",
    l4_anchor: skill.l4_anchor ?? "",
    l5_anchor: skill.l5_anchor ?? "",
    expected_level: skill.expected_level ?? 3,
  };
}

export default function CustomSkillDialog({
  open,
  onOpenChange,
  onSave,
  skill,
}: CustomSkillDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomSkillValues>({ defaultValues: EMPTY_SKILL });

  useEffect(() => {
    if (open) reset(valuesFor(skill));
  }, [open, reset, skill]);

  const saveSkill = (values: CustomSkillValues) => {
    onSave({
      ...skill,
      ...values,
      skill_label: values.skill_label.trim(),
      scope_include: values.scope_include.trim(),
      l1_anchor: values.l1_anchor.trim(),
      l2_anchor: values.l2_anchor.trim(),
      l3_anchor: values.l3_anchor.trim(),
      l4_anchor: values.l4_anchor.trim(),
      l5_anchor: values.l5_anchor.trim(),
      is_custom: true,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form className="space-y-5" onSubmit={handleSubmit(saveSkill)} noValidate>
          <DialogHeader>
            <DialogTitle>{skill ? "Edit custom skill" : "Add custom skill"}</DialogTitle>
            <DialogDescription>
              Define the skill scope and observable behavior for each proficiency level.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="custom-skill-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-skill-name"
              placeholder="e.g. Communication"
              maxLength={MAX_TEXT_FIELD_LENGTH}
              aria-invalid={!!errors.skill_label}
              autoFocus
              {...register("skill_label", requiredText("Skill name is required"))}
            />
            <FieldError message={errors.skill_label?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-skill-scope">
              What counts (scope include) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="custom-skill-scope"
              placeholder="Clear technical explanation, stakeholder alignment, async written communication..."
              rows={2}
              aria-invalid={!!errors.scope_include}
              {...register("scope_include", requiredText("Describe what counts"))}
            />
            <FieldError message={errors.scope_include?.message} />
          </div>

          <fieldset className="space-y-3 rounded-xl bg-rakamin-light-cyan/40 p-3">
            <legend className="sr-only">Level anchors</legend>
            {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map(
              (key, index) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`custom-skill-${key}`}>
                    L{index + 1} anchor <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id={`custom-skill-${key}`}
                    placeholder={LEVEL_PLACEHOLDERS[index + 1]}
                    rows={2}
                    aria-invalid={!!errors[key]}
                    {...register(key, requiredText(`Describe what L${index + 1} looks like`))}
                  />
                  <FieldError message={errors[key]?.message} />
                </div>
              ),
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label>Expected level</Label>
            <LevelRadio
              value={watch("expected_level")}
              onChange={(value) => setValue("expected_level", value, { shouldDirty: true })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{skill ? "Save changes" : "Add skill"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
