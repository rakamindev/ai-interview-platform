import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Notice } from "@/components/motion/Notice";
import FormPageLayout from "@/components/layout/FormPageLayout";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { Plus, Loader2 } from "lucide-react";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export interface AssessmentFormProps {
  initialValues?: Partial<AssessmentFormValues>;
  onSubmit: (values: AssessmentFormValues) => Promise<void>;
  submitting: boolean;
  error?: string | null;
  mode: "create" | "edit";
  title: string;
  description?: string;
  cancelTo?: string;
  backTo?: string;
  backLabel?: string;
}

export default function AssessmentForm({
  initialValues,
  onSubmit,
  submitting,
  error,
  mode,
  title,
  description,
  cancelTo = "/assessments",
  backTo = "/assessments",
  backLabel = "Assessments",
}: AssessmentFormProps) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: initialValues?.name ?? "",
      time_limit_min: initialValues?.time_limit_min ?? 45,
      language: initialValues?.language ?? "en",
      skills: initialValues?.skills ?? [],
    },
  });

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    if (initialValues) {
      reset({
        name: initialValues.name ?? "",
        time_limit_min: initialValues.time_limit_min ?? 45,
        language: initialValues.language ?? "en",
        skills: initialValues.skills ?? [],
      });
    }
  }, [initialValues, reset]);

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

  const addCustomSkill = () => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
  };

  const addB7Skill = (skill: Partial<AssessmentSkill>) => {
    append({ ...skill, display_order: fields.length });
  };

  return (
    <FormPageLayout
      backTo={backTo}
      backLabel={backLabel}
      title={title}
      description={description}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Role title */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="font-medium">
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. Senior Frontend Engineer"
            {...register("name", { required: "Role title is required" })}
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Time limit & language row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="time_limit_min" className="font-medium">
              Session time limit <span className="text-destructive">*</span>
            </Label>
            <Select
              value={String(watch("time_limit_min") ?? 45)}
              onValueChange={(v) => setValue("time_limit_min", Number(v))}
            >
              <SelectTrigger id="time_limit_min" className="w-full">
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

          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="language" className="font-medium">Interview language</Label>
              <Select
                value={watch("language") ?? "en"}
                onValueChange={(v) => setValue("language", v as "en" | "id")}
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Indonesian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator />

        {/* Skills section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium text-base">Skills to assess</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag cards to reorder questioning priority during the interview.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {fields.length} {fields.length === 1 ? "skill" : "skills"}
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground bg-muted/20">
              <p className="font-medium text-foreground mb-1">No skills added yet</p>
              <p className="text-xs">Add skills from taxonomy or custom skills to evaluate candidates.</p>
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
                <div className="space-y-2.5 transition-all duration-200 ease-out">
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

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add from Skill Taxonomy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomSkill}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add custom skill
            </Button>
          </div>
        </div>

        <Separator />

        <Notice show={!!error}>
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-red-800">
            {error}
          </div>
        </Notice>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(cancelTo)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "edit" ? "Save changes" : "Create and invite candidates"}
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
      />
    </FormPageLayout>
  );
}
