import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import PageHeader from "@/components/PageHeader";
import { Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { AssessmentFormSchema } from "@/schemas/forms";
import { m } from "@/paraglide/messages.js";
import type { AssessmentFormValues } from "@/schemas/forms";
import type { AssessmentSkill } from "@/types";

// Re-export for backwards compatibility (SkillCard, CustomSkillForm, AssessmentEditPage)
export type { AssessmentFormValues } from "@/schemas/forms";

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(AssessmentFormSchema),
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: []
    }
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors }
  } = form;
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
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length
    });
  };

  const addB7Skill = (skill: Partial<AssessmentSkill>) => {
    append({ ...skill, display_order: fields.length });
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError(m.assessment.add_skill_error());
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i
        }))
      };
      const res = await assessmentsApi.create(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { errors?: { message?: string }[] } } };
      setError(err?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto">
      <PageHeader
        title={m.assessment.new()}
        description={m.assessment.subtitle()}
        backTo="/assessments"
        backLabel="Back to assessments"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Role title */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            {m.assessment.role_title()} <span className="text-destructive">*</span>
          </Label>
          <Input id="name" placeholder="Senior Frontend Engineer" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Time limit */}
        <div className="space-y-1.5">
          <Label>
            {m.assessment.session_time_limit()} <span className="text-destructive">*</span>
          </Label>
          <Select defaultValue="45" onValueChange={(v) => setValue("time_limit_min", Number(v))}>
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

        {/* Language */}
        <div className="space-y-1.5">
          <Label>{m.assessment.interview_language()}</Label>
          <Select defaultValue="en" onValueChange={(v) => setValue("language", v as "en" | "id")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{m.assessment.language_en()}</SelectItem>
              <SelectItem value="id">{m.assessment.language_id()}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Skills section */}
        <div className="space-y-3">
          <Label>{m.assessment.skills_to_assess()}</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              <p className="mb-1">{m.assessment.no_skills()}</p>
              <p>{m.assessment.add_skill_error()}</p>
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

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {m.assessment.add_from_taxonomy()}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addCustomSkill}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {m.assessment.add_custom_skill()}
            </Button>
          </div>
        </div>

        <Separator />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/assessments")}>
            {m.assessment.cancel()}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {m.assessment.save_create()} →
          </Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addB7Skill} />
    </main>
  );
}
