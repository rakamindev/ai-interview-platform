import { valibotResolver } from "@hookform/resolvers/valibot";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Plus, X } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";

import { SkillPicker } from "@/features/skill-taxonomy/components/skill-picker";
import type { SkillTaxonomy } from "@/features/skill-taxonomy/schemas/skill-taxonomy";
import { createVacancySchema, type CreateVacancy } from "../schemas/vacancy";
import { vacancyMutations } from "../mutations/vacancy";
import { LEVEL_LABELS } from "@/utils/constants";

export function AddVacancyForm() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<CreateVacancy>({
    mode: "onChange",
    resolver: valibotResolver(createVacancySchema),
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      vacancy_skills_attributes: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "vacancy_skills_attributes" });

  const { mutate: create, isPending: isCreating } = useMutation({
    ...vacancyMutations.create(),
    onSuccess: (res) => {
      toastManager.add({
        type: "success",
        title: "Vacancy successfully created!",
      });
      navigate({
        to: "/vacancies/$vacancyId",
        params: { vacancyId: String(res.vacancy.id) },
      });
    },
    onError: (error) => {
      const message = error.data?.errors[0]?.message;
      toastManager.add({
        type: "error",
        title: message ?? "Failed to create vacancy. Please try again.",
      });
    },
  });

  const addB7Skill = (skill: SkillTaxonomy) => {
    append({
      skill_id: skill.skill_id,
      skill_label: skill.skill_label,
      expected_level: 3,
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    create(values);
  });

  return (
    <form id="add-vacancy-form" onSubmit={onSubmit}>
      <FieldGroup>
        <Controller
          name="role_title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="role_title">
                Role title
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="role_title"
                type="text"
                placeholder="Senior Frontend Engineer"
                aria-invalid={fieldState.invalid}
                required
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <FieldSeparator />

        <Field>
          <FieldLabel>
            Expected skills
            <span className="text-destructive">*</span>
          </FieldLabel>

          {fields.length === 0 ? (
            <Empty className="border border-solid">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Briefcase />
                </EmptyMedia>
                <EmptyTitle>No skills added yet.</EmptyTitle>
                <EmptyDescription>Add at least one expected skill to continue.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            fields.map((field, index) => (
              <Card key={field.id} size="sm">
                <div className="flex items-center justify-between gap-1 rounded-t-xl px-(--card-spacing)">
                  <CardTitle>{field.skill_label}</CardTitle>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove skill"
                    onClick={() => remove(index)}
                  >
                    <X />
                  </Button>
                </div>

                <CardContent>
                  <Controller
                    name={`vacancy_skills_attributes.${index}.expected_level`}
                    control={form.control}
                    render={({ field: levelField, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>
                          Expected level
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        <RadioGroup
                          className="flex flex-wrap gap-3"
                          aria-invalid={fieldState.invalid}
                          value={levelField.value}
                          onValueChange={levelField.onChange}
                        >
                          {[1, 2, 3, 4, 5].map((option) => (
                            <div key={option} className="flex items-center gap-1.5">
                              <RadioGroupItem
                                id={`vacancy_skills_attributes.${index}.expected_level.${option}`}
                                value={option}
                              />
                              <Label htmlFor={`vacancy_skills_attributes.${index}.expected_level.${option}`}>
                                {LEVEL_LABELS[option]}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </Field>
                    )}
                  />
                </CardContent>
              </Card>
            ))
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus data-icon="inline-start" />
              Add skill expectation
            </Button>
          </div>
        </Field>

        <FieldSeparator />

        <Controller
          name="culture_dimensions"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="culture_dimensions">Company culture</FieldLabel>
              <Textarea
                {...field}
                id="culture_dimensions"
                placeholder="Ownership-driven, async-first, direct feedback culture..."
                rows={3}
              />
              <FieldDescription className="text-xs text-muted-foreground">Used in AI narrative.</FieldDescription>
            </Field>
          )}
        />

        <Controller
          name="competency_expectations"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="competency_expectations">Competency expectations</FieldLabel>
              <Textarea
                {...field}
                id="competency_expectations"
                placeholder="Clear technical communication, stakeholder alignment, delivery ownership..."
                rows={3}
              />
              <FieldDescription className="text-xs text-muted-foreground">Used in AI narrative.</FieldDescription>
            </Field>
          )}
        />

        <Field orientation="horizontal" className="justify-end">
          <Button variant="outline" nativeButton={false} disabled={isCreating} render={<Link to="/vacancies" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={!form.formState.isValid || isCreating}>
            {isCreating ? <Spinner data-icon="inline-start" /> : null}
            Save
            <ArrowRight data-icon="inline-end" />
          </Button>
        </Field>
      </FieldGroup>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addB7Skill} />
    </form>
  );
}
