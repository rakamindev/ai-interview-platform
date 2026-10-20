import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { Plus, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, language: "en", skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({
          name: a.name,
          time_limit_min: a.time_limit_min,
          language: a.language ?? "en",
          skills: a.skills,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

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
    if (data.skills.length === 0) {
      setError("Please add at least one skill to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({ ...s, display_order: i })),
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Edit Assessment
        </h1>
        <p className="text-sm text-muted-foreground">
          Update role title, session time limit, and competency expectations.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Configuration - Clean open row layout, no card box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 space-y-1.5">
            <Label htmlFor="name" className="text-sm font-semibold text-foreground">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              className="text-sm h-10"
              {...register("name", { required: "Role title is required" })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-sm font-semibold text-foreground">
              Session time limit <span className="text-destructive">*</span>
            </Label>
            <Select
              value={String(form.watch("time_limit_min"))}
              onValueChange={(v) => setValue("time_limit_min", Number(v))}
            >
              <SelectTrigger className="w-full text-sm h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_LIMIT_OPTIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>
                    {min} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-sm font-semibold text-foreground">
              Interview language <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("language") ?? "en"}
              onValueChange={(v) => setValue("language", v as "en" | "id")}
            >
              <SelectTrigger className="w-full text-sm h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English (Global)</SelectItem>
                <SelectItem value="id">Indonesian (Bahasa Indonesia)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Skills Section */}
        <div className="space-y-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Skills to Assess
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define target competencies and minimum expected proficiency levels (L1–L5).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Add from Taxonomy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Custom Skill
              </Button>
            </div>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed p-12 text-center space-y-4 bg-muted/5">
              <p className="text-sm font-semibold text-foreground">No skills added yet</p>
              <p className="text-xs text-muted-foreground">Add at least one skill to assess candidate readiness.</p>
              <div className="pt-2 flex justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Browse Taxonomy
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Custom Skill
                </Button>
              </div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <SkillCard
                      key={field.id}
                      id={field.id}
                      index={index}
                      form={form}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {fields.length > 0 && (
            <div className="flex justify-start gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add more from Taxonomy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add another Custom Skill
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/assessments/${id}/invite`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ ...s, display_order: fields.length })}
      />
    </div>
  );
}
