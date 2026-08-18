import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Brain, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";

import { SkillPicker } from "@/features/skill-taxonomy/components/skill-picker";
import { SkillCard } from "@/features/assessment/components/skill-card";
import type { SkillTaxonomy } from "@/features/skill-taxonomy/schemas/skill-taxonomy";
import { createAssessmentSchema, type CreateAssessment } from "../schemas/assessment";
import { INTERVIEW_LANGUAGE, TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { useMutation } from "@tanstack/react-query";
import { assessmentMutations } from "../mutations/assessment";

export function AddAssessmentForm() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<CreateAssessment>({
    mode: "onChange",
    resolver: valibotResolver(createAssessmentSchema),
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      assessment_skills_attributes: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "assessment_skills_attributes",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { mutate: create, isPending: isLoading } = useMutation({
    ...assessmentMutations.create(),
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "Assessment successfully created!",
      });
      navigate({
        to: "/assessments",
      });
    },
  });

  const addB7Skill = (skill: SkillTaxonomy) => {
    append({
      skill_id: skill.skill_id,
      skill_label: skill.skill_label,
      scope_include: skill.scope_include,
      scope_exclude: skill.scope_exclude,
      l1_anchor: skill.l1_anchor,
      l2_anchor: skill.l2_anchor,
      l3_anchor: skill.l3_anchor,
      l4_anchor: skill.l4_anchor,
      l5_anchor: skill.l5_anchor,
      is_custom: false,
      expected_level: 3,
      display_order: fields.length,
    });
  };

  const addCustomSkill = () => {
    append({
      skill_id: null,
      skill_label: "",
      scope_include: "",
      scope_exclude: "",
      l1_anchor: "",
      l2_anchor: "",
      l3_anchor: "",
      l4_anchor: "",
      l5_anchor: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    create({
      ...values,
      assessment_skills_attributes: values.assessment_skills_attributes.map((skill, index) => ({
        ...skill,
        display_order: index,
      })),
    });
  });

  return (
    <form id="add-assessment-form" onSubmit={onSubmit}>
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">
                Role title
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="name"
                type="text"
                placeholder="Senior Frontend Engineer"
                aria-invalid={fieldState.invalid}
                required
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="time_limit_min"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="time_limit_min">
                Session time limit
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                items={TIME_LIMIT_OPTIONS}
                value={field.value}
                aria-invalid={fieldState.invalid}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="time_limit_min" className="w-40!">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIME_LIMIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="language"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="language">
                Interview language
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                items={INTERVIEW_LANGUAGE}
                value={field.value}
                aria-invalid={fieldState.invalid}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="language" className="w-40!">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {INTERVIEW_LANGUAGE.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <FieldSeparator />

        <Field>
          <FieldLabel htmlFor="language">
            Skills to assess
            <span className="text-destructive">*</span>
          </FieldLabel>

          {fields.length === 0 ? (
            <Empty className="border border-solid">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Brain />
                </EmptyMedia>
                <EmptyTitle>No skills added yet.</EmptyTitle>
                <EmptyDescription>Add at least one skill to continue.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {fields.map((field, index) => (
                  <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => remove(index)} />
                ))}
              </SortableContext>
            </DndContext>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus data-icon="inline-start" />
              Add from Skill Taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addCustomSkill}>
              <Plus data-icon="inline-start" />
              Add custom skill
            </Button>
          </div>
        </Field>

        <Field orientation="horizontal" className="justify-end">
          <Button variant="outline" nativeButton={false} disabled={isLoading} render={<Link to="/assessments" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={!form.formState.isValid || isLoading}>
            {isLoading ? <Spinner data-icon="inline-start" /> : null}
            Save
            <ArrowRight data-icon="inline-end" />
          </Button>
        </Field>
      </FieldGroup>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addB7Skill} />
    </form>
  );
}
