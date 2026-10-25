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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
  const [hasEndedSessions, setHasEndedSessions] = useState(false);
  const [roleTitleOptions, setRoleTitleOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
  });

  useEffect(() => {
    assessmentsApi
      .roleTitles()
      .then((res) => {
        const titles = (res.data.role_titles ?? []).map((t) => ({
          label: t,
          value: t,
        }));
        setRoleTitleOptions(titles);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({
          name: a.name,
          time_limit_min: a.time_limit_min,
          skills: a.skills,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    assessmentsApi
      .getSessions(Number(id))
      .then((res) => {
        setHasEndedSessions(
          res.data.sessions.some((s) => s.status === "ended")
        );
      })
      .catch(() => {});
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
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(
        e?.response?.data?.errors?.[0]?.message ?? "Failed to save."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Assessments", href: "/assessments" },
            { label: "Edit" },
          ]}
        />
      </div>

      {hasEndedSessions && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Some candidates have already completed interviews with this
            assessment. Changes will only apply to new sessions. Existing
            coverage maps and portfolios will not be affected.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white border border-gray-200 rounded-xl p-7">
          {/* Section: Role */}
          <div className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Role details
          </div>

          <div className="mb-5">
            <Label htmlFor="name" className="mb-1.5">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Combobox
              options={roleTitleOptions}
              value={watch("name")}
              onChange={(val) =>
                setValue("name", val, { shouldValidate: true })
              }
              placeholder="Select or type a role title..."
            />
            <input
              type="hidden"
              {...register("name", { required: true })}
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="mb-5">
            <Label className="mb-1.5">
              Session time limit <span className="text-destructive">*</span>
            </Label>
            <Select
              value={String(form.watch("time_limit_min"))}
              onValueChange={(v) =>
                setValue("time_limit_min", Number(v))
              }
            >
              <SelectTrigger className="w-40">
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

          <hr className="border-gray-200 my-6" />

          {/* Section: Skills */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-900">
              Skills to assess
            </span>
            <span className="text-xs text-gray-500">
              At least 1 required
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg py-7 px-5 text-center mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-7 h-7 text-gray-400"
                >
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
              </div>
              <p className="text-[13px] text-gray-500">
                No skills added yet.
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Add at least one to continue.
              </p>
            </div>
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
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
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

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add from taxonomy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() =>
                append({
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

          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-5 mt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="ghost"
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
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) =>
          append({ ...s, display_order: fields.length })
        }
        selectedSkillIds={fields
          .filter((f) => f.skill_id)
          .map((f) => f.skill_id!)}
        selectedSkillLabels={fields
          .filter((f) => !f.skill_id && f.skill_label)
          .map((f) => f.skill_label!)}
      />
    </div>
  );
}
