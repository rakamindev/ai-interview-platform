
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
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

  // IDs of existing skills removed from the form.
  const [deletedSkillIds, setDeletedSkillIds] = useState<number[]>([]);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      skills: [],
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
  });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setDeletedSkillIds([]);
    setError(null);

    assessmentsApi
      .get(Number(id))
      .then((res) => {
        if (cancelled) return;

        const assessment = res.data.assessment;

        reset({
          name: assessment.name,
          time_limit_min: assessment.time_limit_min,
          skills: assessment.skills ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load assessment.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, reset]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        move(oldIndex, newIndex);
      }
    }
  };

  const handleRemoveSkill = (index: number) => {
    const skill = form.getValues(`skills.${index}`);

    // Existing database records need an explicit destroy instruction.
    if (typeof skill.id === "number") {
      setDeletedSkillIds((currentIds) =>
        currentIds.includes(skill.id!)
          ? currentIds
          : [...currentIds, skill.id!]
      );
    }

    remove(index);
  };

  const handleAddSkill = (skill: Partial<AssessmentSkill>) => {
    // If a previously removed skill is added back before saving,
    // don't send its ID as deleted.
    if (typeof skill.id === "number") {
      setDeletedSkillIds((currentIds) =>
        currentIds.filter((deletedId) => deletedId !== skill.id)
      );
    }

    append({
      ...skill,
      skill_label: skill.skill_label ?? "",
      is_custom: skill.is_custom ?? true,
      expected_level: skill.expected_level ?? 3,
      display_order: fields.length,
    } as AssessmentFormValues["skills"][number]);
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Add at least one skill.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const activeSkills = data.skills.map((skill, index) => ({
        ...skill,
        display_order: index,
      }));

      const deletedSkills = deletedSkillIds.map((skillId) => ({
        id: skillId,
        _destroy: true,
      }));

      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: [
          ...activeSkills,
          ...deletedSkills,
        ],
      });

      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(
        e?.response?.data?.errors?.[0]?.message ??
          "Failed to save assessment."
      );
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link
          to="/assessments"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Role title <span className="text-destructive">*</span>
          </Label>

          <Input
            id="name"
            {...register("name", { required: true })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Session time limit <span className="text-destructive">*</span>
          </Label>

          <Select
            value={String(form.watch("time_limit_min"))}
            onValueChange={(value) =>
              setValue("time_limit_min", Number(value))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((minutes) => (
                <SelectItem
                  key={minutes}
                  value={String(minutes)}
                >
                  {minutes} min
                </SelectItem>
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((field) => field.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <SkillCard
                      key={field.id}
                      id={field.id}
                      index={index}
                      form={form}
                      onRemove={() => handleRemoveSkill(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add from B7 taxonomy
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                handleAddSkill({
                  skill_label: "",
                  is_custom: true,
                  expected_level: 3,
                  display_order: fields.length,
                })
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add custom skill
            </Button>
          </div>
        </div>

        <Separator />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/assessments/${id}/invite`)}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={submitting}>
            {submitting && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(skill) => handleAddSkill(skill)}
      />
    </div>
  );
}
