import { useCallback, useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import ApiErrorList from "@/components/ApiErrorList";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { apiErrorMessages } from "@/utils/apiErrors";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, language: "en", skills: [] },
  });

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  const loadAssessment = useCallback(() => {
    setLoading(true);
    setLoadError(false);
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
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => loadAssessment(), [loadAssessment]);

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
      setServerErrors(["Add at least one skill to continue."]);
      return;
    }
    setServerErrors([]);
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
      setServerErrors(apiErrorMessages(e, "Failed to save assessment."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadError) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {loadError ? (
          <div role="alert" className="space-y-4 rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
            <div>
              <h1 className="font-semibold">Assessment could not be loaded</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your changes have not been saved. Try loading it again.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={loadAssessment}>Try again</Button>
              <Button asChild variant="ghost" className="w-full sm:w-auto"><Link to="/assessments">Back to assessments</Link></Button>
            </div>
          </div>
        ) : (
          <>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-24 w-full" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to={`/assessments/${id}/invite`} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ArrowLeft className="h-4 w-4" />
        Back to assessment
      </Link>

      <div className="space-y-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Edit assessment</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Update the role, interview length, or skills. Changes apply to candidates you invite next.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="overflow-hidden rounded-xl border bg-card">
        <section aria-labelledby="assessment-details-heading" className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 id="assessment-details-heading" className="font-semibold">Assessment details</h2>
            <p className="mt-1 text-sm text-muted-foreground">The role title, interview length, and the language the AI interviews in.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "role-title-error" : undefined}
              placeholder="Senior Frontend Engineer"
              {...register("name", { required: "Role title is required" })}
            />
            {errors.name && (
              <p id="role-title-error" className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="time-limit">
                Session time limit <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(watch("time_limit_min"))}
                onValueChange={(v) => setValue("time_limit_min", Number(v))}
              >
                <SelectTrigger id="time-limit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Interview language</Label>
              <Select
                value={watch("language")}
                onValueChange={(v) => setValue("language", v as "en" | "id")}
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">The AI interviewer speaks this language with the candidate.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="assessment-skills-heading" className="space-y-4 border-t p-5 sm:p-6">
          <div>
            <h2 id="assessment-skills-heading" className="font-semibold">Skills to assess</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add the skills this interview should cover and the level expected for each. Drag to reorder the interview flow.</p>
          </div>

          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center">
              <p className="text-sm font-medium">No skills added yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Add at least one skill so the AI knows what to probe for.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => remove(index)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add from skill taxonomy
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}
            >
              <Plus className="h-4 w-4" />
              Add custom skill
            </Button>
          </div>
        </section>

        <div className="space-y-4 border-t bg-muted/20 p-5 sm:px-6">
          <ApiErrorList errors={serverErrors} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/assessments/${id}/invite`)}>Cancel</Button>
            <Button type="submit" className="w-full px-5 sm:w-auto" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
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
