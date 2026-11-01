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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import CustomSkillDialog from "@/components/assessment/CustomSkillDialog";
import FieldError from "@/components/FieldError";
import LoadError from "@/components/LoadError";
import EmptyState from "@/components/EmptyState";
import FormSection from "@/components/FormSection";
import Notice from "@/components/Notice";
import PageHeader from "@/components/layout/PageHeader";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { ListChecks, Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { MAX_TEXT_FIELD_LENGTH, requiredText } from "@/utils/validation";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentFormValues } from "./AssessmentNewPage";
import type { AssessmentSkill } from "@/types";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customSkillOpen, setCustomSkillOpen] = useState(false);
  const [editingCustomSkill, setEditingCustomSkill] = useState<{
    index: number;
    skill: Partial<AssessmentSkill>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Saved skills the assessor removed; the API only deletes nested rows marked _destroy.
  const [removedSkillIds, setRemovedSkillIds] = useState<number[]>([]);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, language: "en", skills: [] },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isDirty },
  } = form;
  const { fields, append, remove, move, update } = useFieldArray({ control, name: "skills" });
  const { blocker, allowNavigation } = useUnsavedChangesGuard(isDirty);

  const loadAssessment = useCallback(() => {
    setLoading(true);
    setLoadError(null);
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
        setRemovedSkillIds([]);
      })
      .catch((requestError: unknown) =>
        setLoadError(
          getApiErrorStatus(requestError) === 404
            ? "This assessment doesn't exist or was deleted."
            : getApiErrorMessage(requestError, "Failed to load the assessment."),
        ),
      )
      .finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const removeSkill = (index: number) => {
    const savedId = getValues(`skills.${index}.id`);
    if (savedId) setRemovedSkillIds((prev) => [...prev, savedId]);
    remove(index);
  };

  const openNewCustomSkill = () => {
    setEditingCustomSkill(null);
    setCustomSkillOpen(true);
  };

  const openCustomSkillEditor = (index: number) => {
    setEditingCustomSkill({ index, skill: getValues(`skills.${index}`) });
    setCustomSkillOpen(true);
  };

  const saveCustomSkill = (skill: Partial<AssessmentSkill>) => {
    if (editingCustomSkill) {
      update(editingCustomSkill.index, skill);
      return;
    }

    append({ ...skill, display_order: fields.length });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
      setError("Add at least one skill.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name.trim(),
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: [
          ...data.skills.map((s, i) => ({ ...s, display_order: i })),
          ...removedSkillIds.map((skillId) => ({ id: skillId, _destroy: true })),
        ],
      });
      allowNavigation();
      navigate(`/assessments/${id}/invite`);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, "Failed to save."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader backTo="/assessments" backLabel="Back to assessments" title="Edit assessment" />
        <LoadError message={loadError} onRetry={loadAssessment} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo={`/assessments/${id}/invite`}
        backLabel="Back to assessment"
        eyebrow="Edit assessment"
        title="Update the skill interview"
        description="Changes apply to candidates you invite from now on."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection title="Role and settings">
          <div className="space-y-2">
            <Label htmlFor="name">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              maxLength={MAX_TEXT_FIELD_LENGTH}
              aria-invalid={!!errors.name}
              {...register("name", requiredText("Role title is required"))}
            />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Session time limit <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(watch("time_limit_min"))}
                onValueChange={(v) => setValue("time_limit_min", Number(v), { shouldDirty: true })}
              >
                <SelectTrigger>
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
              <Label>Interview language</Label>
              <Select
                value={watch("language")}
                onValueChange={(v) => setValue("language", v as "en" | "id", { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Indonesian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Skills to assess"
          description="Drag to reorder. The interviewer covers skills roughly in this order."
        >
          {fields.length === 0 ? (
            <EmptyState icon={ListChecks} title="No skills added yet." />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <SkillCard
                      key={field.id}
                      id={field.id}
                      index={index}
                      form={form}
                      onRemove={() => removeSkill(index)}
                      onEditCustom={() => openCustomSkillEditor(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus /> Add from B7 taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openNewCustomSkill}>
              <Plus /> Add custom skill
            </Button>
          </div>
        </FormSection>

        {error && <Notice variant="error">{error}</Notice>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/assessments/${id}/invite`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog blocker={blocker} />

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ ...s, display_order: fields.length })}
        addedLabels={watch("skills").map((s) => s.skill_label ?? "")}
      />

      <CustomSkillDialog
        open={customSkillOpen}
        onOpenChange={setCustomSkillOpen}
        onSave={saveCustomSkill}
        skill={editingCustomSkill?.skill}
      />
    </div>
  );
}
