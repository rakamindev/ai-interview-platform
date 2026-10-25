import { useEffect, useRef, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { AlertCircle, ArrowLeft, Plus, Loader2, Save } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const removedSkillIds = useRef<Set<number>>(new Set());

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isDirty } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        removedSkillIds.current.clear();
        reset({ name: a.name, time_limit_min: a.time_limit_min, skills: a.skills });
      })
      .catch(() => setLoadError("Unable to load this assessment. Please refresh or return to the assessment."))
      .finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

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

  const removeSkill = (index: number) => {
    const skill = form.getValues(`skills.${index}`);
    if (typeof skill?.id === "number") {
      removedSkillIds.current.add(skill.id);
    }
    remove(index);
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) { setError("Add at least one skill."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: [
          ...data.skills.map((s, i) => ({ ...s, display_order: i })),
          ...Array.from(removedSkillIds.current, (skillId) => ({
            id: skillId,
            _destroy: true,
          })),
        ],
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard your unsaved changes?")) return;
    navigate(`/assessments/${id}/invite`);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" role="alert">
        <p className="text-sm text-destructive">{loadError}</p>
        <Link to={`/assessments/${id}/invite`} className="text-sm text-primary hover:underline">Back to assessment</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to={`/assessments/${id}/invite`} aria-label="Back to assessment" onClick={(event) => { if (isDirty && !window.confirm("Discard your unsaved changes?")) event.preventDefault(); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Assessment settings</p>
          <h1 className="text-2xl font-semibold tracking-tight">Edit assessment</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assessment details</CardTitle>
            <CardDescription>Set the role title and time allowed for each interview.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor="name">Role title <span className="text-destructive">*</span></Label>
              <Input id="name" aria-invalid={!!errors.name} {...register("name", { required: true })} />
              {errors.name && <p className="text-xs text-destructive">Role title is required.</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Time limit <span className="text-destructive">*</span></Label>
              <Select
                value={String(form.watch("time_limit_min"))}
                onValueChange={(v) => setValue("time_limit_min", Number(v))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Skills to assess</CardTitle>
                <CardDescription className="mt-1">Drag to reorder. The order determines the interview focus.</CardDescription>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{fields.length} {fields.length === 1 ? "skill" : "skills"}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
          {fields.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => removeSkill(index)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from B7 taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom skill
            </Button>
          </div>
          </CardContent>
        </Card>

        {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">{isDirty ? "Unsaved changes" : "All changes saved"}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button type="submit" disabled={submitting || !isDirty}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {!submitting && <Save className="h-4 w-4" />}
            Save changes
          </Button>
          </div>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} />
    </div>
  );
}
