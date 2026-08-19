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
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { Plus, Loader2, Sparkles, Bot, Clock, Globe } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { useToast } from "@/hooks/useToast";
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
  const { success, error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "id",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  const watchedValues = watch();

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
      l1_anchor: "Basic conceptual familiarity.",
      l2_anchor: "Guided practical implementation.",
      l3_anchor: "Autonomous standard production delivery.",
      l4_anchor: "Complex problem solving & mentoring.",
      l5_anchor: "Strategic architectural authority.",
    });
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
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      };
      const res = await assessmentsApi.create(payload);
      success("Assessment created", "Ready to invite candidates.");
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      const msg = e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error || "Failed to save assessment.";
      setError(msg);
      toastError("Failed to save", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Assessment"
        description="Configure role competencies, rubric anchors, and AI interview parameters."
        backHref="/assessments"
        backLabel="Assessments"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form inputs */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="shadow-xs">
              <CardHeader className="p-4 pb-3 border-b">
                <CardTitle className="text-sm font-semibold">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Role Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Senior Frontend Engineer"
                    {...register("name", { required: "Role title is required" })}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Session Time Limit</Label>
                    <Select
                      defaultValue="45"
                      onValueChange={(v) => setValue("time_limit_min", Number(v))}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-1.5">
                    <Label>Interview Language</Label>
                    <Select
                      defaultValue="id"
                      onValueChange={(v) => setValue("language", v as "en" | "id")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id">🇮🇩 Bahasa Indonesia</SelectItem>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skills Section */}
            <Card className="shadow-xs">
              <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Skills to Assess ({fields.length})</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Taxonomy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addCustomSkill}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Custom
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {fields.length === 0 ? (
                  <div className="border border-dashed rounded-xl p-8 text-center space-y-3 bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      No skills added yet. Add skills from the standard B7 Taxonomy or define custom competencies.
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add from Skill Taxonomy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomSkill}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Skill
                      </Button>
                    </div>
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
                      <div className="space-y-2.5">
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
              </CardContent>
            </Card>

            {error && (
              <div className="p-3 rounded-lg text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/assessments")}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save &amp; Generate Invites &rarr;
              </Button>
            </div>
          </div>

          {/* Right Column: Live Sticky Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
            <Card className="shadow-xs border-primary/30 bg-card">
              <CardHeader className="p-4 pb-2 border-b bg-muted/20">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Bot className="h-4 w-4" /> AI Interview Preview
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">Live Preview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 text-xs">
                <div>
                  <span className="text-muted-foreground text-[11px] block">Role Assessment</span>
                  <p className="font-bold text-sm text-foreground">
                    {watchedValues.name || "Untitled Assessment"}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1 border-t">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{watchedValues.time_limit_min || 45} minutes</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Language: <strong className="uppercase">{watchedValues.language}</strong></span>
                  </div>
                </div>

                {/* Skill Matrix Preview */}
                <div className="space-y-2 pt-2 border-t">
                  <span className="font-semibold text-foreground text-xs block">
                    Expected Competencies Matrix ({fields.length})
                  </span>
                  {fields.length === 0 ? (
                    <p className="text-muted-foreground italic text-[11px]">
                      Add skills on the left to see rubric breakdown.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {watchedValues.skills?.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border text-[11px]"
                        >
                          <span className="font-medium text-foreground truncate pr-2">
                            {s.skill_label || `Skill #${idx + 1}`}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-background border font-mono text-[10px] text-primary shrink-0 font-bold">
                            L{s.expected_level || 3}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1 mt-2">
                  <p className="font-semibold text-primary text-[11px]">
                    Automatic Prompt Generation
                  </p>
                  <p className="text-muted-foreground text-[10px] leading-relaxed">
                    Upon saving, a dedicated background worker compiles these rubrics into a tailored system prompt for Gemini Live audio conversation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
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
