import { useCallback, useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Callout } from "@/components/ui/callout";
import { ErrorState } from "@/components/ui/error-state";
import { FieldError, FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";
import { useRetryFocus } from "@/hooks/useRetryFocus";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  // A failed load shows an error instead of an empty form that could be saved.
  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({ name: a.name, time_limit_min: a.time_limit_min, skills: a.skills });
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(load, [load]);
  const { headingRef, markRetry } = useRetryFocus(loading);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) { setError("Add at least one skill."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: data.skills.map((s, i) => ({ ...s, display_order: i })),
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <PageHeader ref={headingRef} title="Edit Assessment" back={{ to: "/assessments", label: "Back to assessments" }}
                description="Change the role title, time limit or skills to assess." />
  );

  if (loading) {
    return (
      <PageShell width="narrow">
        {header}
        <div aria-busy="true" aria-label="Loading assessment" className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageShell>
    );
  }

  if (loadFailed) {
    return (
      <PageShell width="narrow">
        {header}
        <ErrorState title="Could not load this assessment" description="Nothing was changed. Try again to edit it." onRetry={() => { markRetry(); load(); }} />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      {header}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormSection title="Details">
          <div className="space-y-1.5">
            <Label htmlFor="name">Role title <span aria-hidden="true" className="text-destructive">*</span></Label>
            <Input id="name" aria-required="true" aria-invalid={errors.name ? true : undefined}
                   aria-describedby={errors.name ? "name-error" : undefined}
                   {...register("name", { required: "Role title is required" })} />
            <FieldError id="name-error">{errors.name?.message}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="time_limit_min">Session time limit <span aria-hidden="true" className="text-destructive">*</span></Label>
            <Select
              value={String(form.watch("time_limit_min"))}
              onValueChange={(v) => setValue("time_limit_min", Number(v))}
            >
              <SelectTrigger id="time_limit_min" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_LIMIT_OPTIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        <FormSection title="Skills to assess" description="Drag a skill to change the order. Each skill needs an expected level.">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => remove(index)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Add from B7 taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Add custom skill
            </Button>
          </div>
        </FormSection>

        {error && <Callout variant="error" role="alert" title={error} />}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/assessments/${id}/invite`)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} />
    </PageShell>
  );
}
