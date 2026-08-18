import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import type { CreateAssessment } from "@/features/assessment/schemas/assessment";
import { cn } from "@/lib/utils";
import { LEVEL_LABELS, LEVEL_PLACEHOLDERS } from "@/utils/constants";

interface SkillCardProps {
  index: number;
  id: string;
  form: UseFormReturn<CreateAssessment>;
  onRemove: () => void;
}

export function SkillCard({ index, id, form, onRemove }: SkillCardProps) {
  const [anchorsOpen, setAnchorsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const skill = useWatch({ control: form.control, name: `assessment_skills_attributes.${index}` });
  const isCustom = skill.is_custom;
  const skillLabel = skill.skill_label || "New Skill";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} size="sm" style={style} className={cn(isDragging && "opacity-50 shadow-lg")}>
      <div className="flex items-center justify-between gap-1 rounded-t-xl px-(--card-spacing)">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 shrink-0" />
          </button>
          <CardTitle>{skillLabel}</CardTitle>
          <span className="shrink-0 text-xs text-muted-foreground">
            {isCustom ? "Custom" : skill.skill_id ? `SK-${String(skill.skill_id).padStart(3, "0")}` : ""}
          </span>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove skill" onClick={onRemove}>
          <X />
        </Button>
      </div>

      <CardContent>
        {isCustom ? (
          <FieldGroup>
            <Controller
              name={`assessment_skills_attributes.${index}.skill_label`}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`assessment_skills_attributes.${index}.skill_label`}>
                    Name
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id={`assessment_skills_attributes.${index}.skill_label`}
                    type="text"
                    placeholder="e.g. Communication"
                    aria-invalid={fieldState.invalid}
                    required
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name={`assessment_skills_attributes.${index}.scope_include`}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`assessment_skills_attributes.${index}.scope_include`}>
                    What counts (scope include)
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id={`assessment_skills_attributes.${index}.scope_include`}
                    placeholder="Clear technical explanation, stakeholder alignment, async written communication..."
                    aria-invalid={fieldState.invalid}
                    required
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((key, i) => (
              <Controller
                key={`assessment_skills_attributes.${index}.${key}`}
                name={`assessment_skills_attributes.${index}.${key}`}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`assessment_skills_attributes.${index}.${key}`}>
                      L{i + 1} anchor
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={`assessment_skills_attributes.${index}.${key}`}
                      placeholder={LEVEL_PLACEHOLDERS[i + 1]}
                      aria-invalid={fieldState.invalid}
                      required
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            ))}

            <Controller
              name={`assessment_skills_attributes.${index}.expected_level`}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`assessment_skills_attributes.${index}.expected_level_label`}>
                    Expected level
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <RadioGroup
                    className="flex flex-wrap gap-3"
                    aria-invalid={fieldState.invalid}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    {[1, 2, 3, 4, 5].map((option) => (
                      <div key={option} className="flex items-center gap-1.5">
                        <RadioGroupItem
                          id={`assessment_skills_attributes.${id}.expected_level_label.${option}`}
                          value={option}
                        />
                        <Label htmlFor={`assessment_skills_attributes.${id}.expected_level_label.${option}`}>
                          {LEVEL_LABELS[option]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        ) : (
          <div className="space-y-3">
            <Collapsible open={anchorsOpen} onOpenChange={setAnchorsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                {anchorsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {anchorsOpen ? "Hide L1–L5 anchors" : "Show L1–L5 anchors"}
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-3">
                <div className="space-y-1 rounded bg-muted p-2 text-xs text-muted-foreground">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const anchor = skill[`l${level}_anchor` as keyof typeof skill] as string;
                    return anchor ? (
                      <div key={level}>
                        <span className="font-medium text-foreground">L{level}</span> {anchor}
                      </div>
                    ) : null;
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Controller
              name={`assessment_skills_attributes.${index}.expected_level`}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`assessment_skills_attributes.${index}.expected_level_label`}>
                    Expected level
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <RadioGroup
                    className="flex flex-wrap gap-3"
                    aria-invalid={fieldState.invalid}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    {[1, 2, 3, 4, 5].map((option) => (
                      <div key={option} className="flex items-center gap-1.5">
                        <RadioGroupItem
                          id={`assessment_skills_attributes.${id}.expected_level_label.${option}`}
                          value={option}
                        />
                        <Label htmlFor={`assessment_skills_attributes.${id}.expected_level_label.${option}`}>
                          {LEVEL_LABELS[option]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
