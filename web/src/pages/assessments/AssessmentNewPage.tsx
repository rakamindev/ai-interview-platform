import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import CustomSkillDialog from "@/components/assessment/CustomSkillDialog";
import FieldError from "@/components/FieldError";
import EmptyState from "@/components/EmptyState";
import FormSection from "@/components/FormSection";
import Notice from "@/components/Notice";
import PageHeader from "@/components/layout/PageHeader";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { ListChecks, Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { getApiErrorMessage } from "@/lib/apiError";
import { MAX_TEXT_FIELD_LENGTH, requiredText } from "@/utils/validation";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customSkillOpen, setCustomSkillOpen] = useState(false);
  const [editingCustomSkill, setEditingCustomSkill] = useState<{
    index: number;
    skill: Partial<AssessmentSkill>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    formState: { errors, isDirty },
  } = form;
  const { fields, append, remove, move, update } = useFieldArray({ control, name: "skills" });
  const { blocker, allowNavigation } = useUnsavedChangesGuard(isDirty);

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

  const addB7Skill = (skill: Partial<AssessmentSkill>) => {
    append({ ...skill, display_order: fields.length });
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Add at least one skill to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      };
      const res = await assessmentsApi.create(payload);
      allowNavigation();
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, "Failed to save assessment."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo="/assessments"
        backLabel="Back to assessments"
        eyebrow="New assessment"
        title="Set up a skill interview"
        description="Choose the role, interview settings, and the skills the AI interviewer should assess."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection title="Role and settings">
          <div className="space-y-2">
            <Label htmlFor="name">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Senior Frontend Engineer"
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
                defaultValue="45"
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
                defaultValue="en"
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
            <EmptyState
              icon={ListChecks}
              title="No skills added yet."
              description="Add at least one skill to continue."
            />
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
                      onRemove={() => remove(index)}
                      onEditCustom={() => openCustomSkillEditor(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus />
              Add from Skill Taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openNewCustomSkill}>
              <Plus />
              Add custom skill
            </Button>
          </div>
        </FormSection>

        {error && <Notice variant="error">{error}</Notice>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/assessments")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Save &amp; Create Session →
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog blocker={blocker} />

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
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
