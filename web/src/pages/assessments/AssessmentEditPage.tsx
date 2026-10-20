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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2, RefreshCw } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { assessmentSchema } from "@/schemas/assessment";
import { apiErrorMessage } from "@/lib/httpError";
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
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const originalSkillIdsRef = useRef<number[]>([]);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    setLoadError(false);
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        const skills = (a.skills ?? []).map((skill: AssessmentSkill) => ({
          ...skill,
          expected_level: skill.expected_level ?? 3,
          skill_id: skill.skill_id ? String(skill.skill_id) : (skill.id ? "legacy-skill" : undefined),
          scope_include: skill.scope_include ?? "",
          scope_exclude: skill.scope_exclude ?? "",
          l1_anchor: skill.l1_anchor ?? "",
          l2_anchor: skill.l2_anchor ?? "",
          l3_anchor: skill.l3_anchor ?? "",
          l4_anchor: skill.l4_anchor ?? "",
          l5_anchor: skill.l5_anchor ?? "",
        }));
        originalSkillIdsRef.current = skills.flatMap((skill) =>
          typeof skill.id === "number" ? [skill.id] : []
        );
        reset({ name: a.name, time_limit_min: a.time_limit_min, skills });
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, reset, retryCount]);

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
    const parsed = assessmentSchema.safeParse({
      name: data.name,
      time_limit_min: data.time_limit_min,
      skills: data.skills.map((skill) => {
        const legacyFieldFallback = skill.id ? "legacy field" : "";
        return {
          ...skill,
          skill_id: skill.skill_id ? String(skill.skill_id) : undefined,
          scope_include: skill.scope_include || legacyFieldFallback,
          l1_anchor: skill.l1_anchor || legacyFieldFallback,
          l2_anchor: skill.l2_anchor || legacyFieldFallback,
          l3_anchor: skill.l3_anchor || legacyFieldFallback,
          l4_anchor: skill.l4_anchor || legacyFieldFallback,
          l5_anchor: skill.l5_anchor || legacyFieldFallback,
        };
      }),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the assessment fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const normalizedSkills = parsed.data.skills.map((skill, index) => ({
        ...data.skills[index],
        ...skill,
        display_order: index,
      }));
      const submittedSkillIds = new Set(
        normalizedSkills.flatMap((skill) =>
          typeof skill.id === "number" ? [skill.id] : []
        )
      );
      const removedSkills = originalSkillIdsRef.current
        .filter((skillId) => !submittedSkillIds.has(skillId))
        .map((skillId) => ({ id: skillId, _destroy: true }));

      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: [...normalizedSkills, ...removedSkills],
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e) {
      setError(apiErrorMessage(e, "Failed to save."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/assessments/${id}`} aria-label="Back to assessment" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium">Edit Assessment</span>
        </div>
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3" role="alert">
          <p className="text-sm text-destructive">We could not load this assessment.</p>
          <p className="text-xs text-muted-foreground">Nothing was changed. Retry to load it again.</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((count) => count + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Link to={`/assessments/${id}`} aria-label="Back to assessment" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">Role title <span className="text-destructive">*</span></Label>
          <Input id="name" {...register("name", { required: true })} />
        </div>

        <div className="space-y-1.5">
          <Label>Session time limit <span className="text-destructive">*</span></Label>
          <Select
            value={String(form.watch("time_limit_min"))}
            onValueChange={(v) => setValue("time_limit_min", Number(v))}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Skills to assess</Label>
          {fields.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from B7 taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom skill
            </Button>
          </div>
        </div>

        <Separator />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-background py-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/assessments/${id}`)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} />
    </div>
  );
}
