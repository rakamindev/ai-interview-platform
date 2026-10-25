import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { extractApiError } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import { assessmentKeys } from "@/lib/queryKeys";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: assessmentsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() }),
  });

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

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
    setSkillsError(null);
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
  };

  const addB7Skill = (skill: Partial<AssessmentSkill>) => {
    setSkillsError(null);
    append({ ...skill, display_order: fields.length });
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setSkillsError("Add at least one skill before creating the assessment.");
      return;
    }
    setSkillsError(null);
    setError(null);
    try {
      const payload = {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      };
      const res = await createMutation.mutateAsync(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e) {
      setError(extractApiError(e).message);
    }
  };

  const onInvalidSubmit = () => {
    if (fields.length === 0) {
      setSkillsError("Add at least one skill before creating the assessment.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6">
        {/* Role title */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Senior Frontend Engineer"
            {...register("name", { required: "Role title is required" })}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Time limit */}
        <div className="space-y-1.5">
          <Label>
            Session time limit <span className="text-destructive">*</span>
          </Label>
          <Select
            defaultValue="45"
            onValueChange={(v) => setValue("time_limit_min", Number(v))}
          >
            <SelectTrigger className="w-full md:w-40">
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

        {/* Language */}
        <div className="space-y-1.5">
          <Label>Interview language</Label>
          <Select
            defaultValue="en"
            onValueChange={(v) => setValue("language", v as "en" | "id")}
          >
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="id">Indonesian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Skills section */}
        <div
          className="space-y-3"
          role="group"
          aria-labelledby="skills-label"
          aria-describedby={skillsError ? "skills-error" : undefined}
          aria-invalid={skillsError ? true : undefined}
        >
          <Label id="skills-label">
            Skills to assess <span className="text-destructive">*</span>
          </Label>

          {fields.length === 0 ? (
            <div
              className={cn(
                "rounded-lg border p-6 text-center text-sm text-muted-foreground transition-colors",
                skillsError && "border-destructive bg-destructive/5"
              )}
            >
              <p className="mb-1">No skills added yet.</p>
              <p>Choose a skill from the taxonomy or add a custom skill.</p>
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
                <div className="space-y-2">
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

          <div className="flex flex-row gap-2">
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
              onClick={addCustomSkill}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add custom skill
            </Button>
          </div>

          {skillsError && (
            <Alert id="skills-error" className="py-2.5">
              <p>{skillsError}</p>
            </Alert>
          )}
        </div>

        <Separator />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/assessments")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save &amp; Create Session →
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
      />
    </div>
  );
}
