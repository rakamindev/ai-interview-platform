import {UseFormReturn, useWatch} from "react-hook-form";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import LevelRadio from "./LevelRadio";
import type {AssessmentFormValues} from "@/pages/assessments/AssessmentNewPage";

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

const ANCHOR_FIELDS = [
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
    const {register, setValue, watch} = form;

    const expectedLevel = useWatch({
        control: form.control,
        name: `skills.${index}.expected_level`,
    });

    return (
        <div className="space-y-3 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
                <Label htmlFor={`skills.${index}.skill_label`}>
                    Name <span className="text-destructive">*</span>
                </Label>

                <Input
                    id={`skills.${index}.skill_label`}
                    placeholder="e.g. Communication"
                    {...register(`skills.${index}.skill_label`, {
                        required: true,
                    })}
                />
            </div>

            {/* Scope */}
            <div className="space-y-1.5">
                <Label htmlFor={`skills.${index}.scope_include`}>
                    What counts (scope include){" "}
                    <span className="text-destructive">*</span>
                </Label>

                <Textarea
                    id={`skills.${index}.scope_include`}
                    placeholder="Clear technical explanation, stakeholder alignment, async written communication..."
                    rows={2}
                    {...register(`skills.${index}.scope_include`, {
                        required: true,
                    })}
                />
            </div>

            {/* Anchors */}
            <div className="space-y-2">
                {ANCHOR_FIELDS.map((key, i) => {
                    const fieldName = `skills.${index}.${key}` as const;
                    const value = watch(fieldName) ?? "";

                    return (
                        <div key={key} className="space-y-1">
                            <Label htmlFor={fieldName}>
                                L{i + 1} anchor{" "}
                                <span className="text-destructive">*</span>
                            </Label>

                            <Textarea
                                id={fieldName}
                                value={value}
                                placeholder={LEVEL_PLACEHOLDERS[i + 1]}
                                rows={2}
                                onChange={(e) =>
                                    setValue(
                                        fieldName,
                                        e.target.value,
                                        {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                        }
                                    )
                                }
                            />
                        </div>
                    );
                })}
            </div>

            {/* Expected level */}
            <div className="space-y-1.5">
                <Label>Expected level</Label>

                <LevelRadio
                    value={expectedLevel ?? 3}
                    onChange={(v) =>
                        setValue(
                            `skills.${index}.expected_level`,
                            v,
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