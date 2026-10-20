import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { assessmentsApi } from "@/services/assessments";
import { assessmentSchema } from "@/schemas/assessment";
import { showRequestError } from "@/lib/requestToast";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { Loader2, Plus } from "lucide-react";
import type { Assessment, AssessmentSkill } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

interface AssessmentFormDialogProps {
  mode: "create" | "edit";
  assessmentId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (assessment: Assessment) => void;
}

const defaultValues: AssessmentFormValues = {
  name: "",
  time_limit_min: 45,
  language: "en",
  skills: [],
};

function normalizeSkills(skills: AssessmentSkill[]) {
  return skills.map((skill) => ({
    ...skill,
    expected_level: skill.expected_level ?? 3,
    skill_id: skill.skill_id
      ? String(skill.skill_id)
      : skill.id
        ? "legacy-skill"
        : undefined,
    scope_include: skill.scope_include ?? "",
    scope_exclude: skill.scope_exclude ?? "",
    l1_anchor: skill.l1_anchor ?? "",
    l2_anchor: skill.l2_anchor ?? "",
    l3_anchor: skill.l3_anchor ?? "",
    l4_anchor: skill.l4_anchor ?? "",
    l5_anchor: skill.l5_anchor ?? "",
  }));
}

export default function AssessmentFormDialog({
  mode,
  assessmentId,
  open,
  onOpenChange,
  onSaved,
}: AssessmentFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const originalSkillIdsRef = useRef<number[]>([]);
  const form = useForm<AssessmentFormValues>({ defaultValues });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      reset(defaultValues);
      setFormError(null);
      originalSkillIdsRef.current = [];
      return;
    }
    if (!assessmentId) return;

    setLoading(true);
    assessmentsApi
      .get(assessmentId)
      .then((res) => {
        const assessment = res.data.assessment;
        const skills = normalizeSkills(assessment.skills ?? []);
        originalSkillIdsRef.current = skills.flatMap((skill) =>
          typeof skill.id === "number" ? [skill.id] : [],
        );
        reset({
          name: assessment.name,
          time_limit_min: assessment.time_limit_min,
          language: assessment.language ?? "en",
          skills,
        });
      })
      .catch((error) =>
        showRequestError(error, "Couldn’t load this assessment."),
      )
      .finally(() => setLoading(false));
  }, [assessmentId, mode, open, reset]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);
    move(oldIndex, newIndex);
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    setFormError(null);
    if (data.skills.length === 0) {
      setFormError("Add at least one skill to continue.");
      return;
    }

    const parsed = assessmentSchema.safeParse({
      name: data.name,
      time_limit_min: data.time_limit_min,
      language: data.language,
      skills: data.skills.map((skill) => {
        const legacyFieldFallback =
          mode === "edit" && skill.id ? "legacy field" : "";
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
      setFormError(parsed.error.issues[0]?.message ?? "Check the assessment fields.");
      return;
    }

    setSubmitting(true);
    try {
      const normalizedSkills = parsed.data.skills.map((skill, index) => ({
        ...data.skills[index],
        ...skill,
        display_order: index,
      }));
      const removedSkills = originalSkillIdsRef.current
        .filter(
          (skillId) => !normalizedSkills.some((skill) => skill.id === skillId),
        )
        .map((skillId) => ({ id: skillId, _destroy: true }));
      const payload = {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: [
          ...normalizedSkills,
          ...(mode === "edit" ? removedSkills : []),
        ],
      };
      const response =
        mode === "create"
          ? await assessmentsApi.create(payload)
          : await assessmentsApi.update(assessmentId!, payload);
      onSaved(response.data.assessment);
      toast.success(
        mode === "create" ? "Assessment created." : "Assessment updated.",
      );
      onOpenChange(false);
    } catch (error) {
      showRequestError(
        error,
        mode === "create"
          ? "Couldn’t create assessment."
          : "Couldn’t update assessment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-5 text-left sm:px-7">
          <DialogTitle>
            {mode === "create" ? "Create assessment" : "Edit assessment"}
          </DialogTitle>
          <DialogDescription>
            Define the role, interview settings, and skills the AI should
            assess.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 px-5 py-10 sm:px-7">
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : (
          <>
            <form
              id="assessment-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6 px-5"
            >
              <div className="space-y-2">
                <Label htmlFor="assessment-name">
                  Role title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="assessment-name"
                  placeholder="e.g. Senior Frontend Engineer"
                  aria-invalid={errors.name ? true : undefined}
                  {...register("name", { required: "Role title is required" })}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Session time limit</Label>
                  <Select
                    value={String(watch("time_limit_min"))}
                    onValueChange={(value) =>
                      setValue("time_limit_min", Number(value))
                    }
                  >
                    <SelectTrigger aria-label="Session time limit">
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
                <div className="space-y-2">
                  <Label>Interview language</Label>
                  <Select
                    value={watch("language")}
                    onValueChange={(value) =>
                      setValue("language", value as "en" | "id")
                    }
                  >
                    <SelectTrigger aria-label="Interview language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="id">Indonesian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Skills to assess</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Order skills by importance. The interview uses these anchors
                    as guidance, not as a transcript limit.
                  </p>
                {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
                </div>
                {fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No skills added yet.
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fields.map((field) => field.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Add from taxonomy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      append({
                        skill_label: "",
                        is_custom: true,
                        expected_level: 3,
                        display_order: fields.length,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" /> Add custom skill
                  </Button>
                </div>
              </div>
            </form>
            <DialogFooter className="sticky bottom-0 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                form="assessment-form"
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create assessment" : "Save changes"}
              </Button>
            </DialogFooter>
          </>
        )}
        <SkillPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(skill) =>
            append({ ...skill, display_order: fields.length })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
