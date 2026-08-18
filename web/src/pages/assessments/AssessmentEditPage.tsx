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
import VacancyPicker from "@/components/assessment/VacancyPicker";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill, VacancySkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vacancyPickerOpen, setVacancyPickerOpen] = useState(false);
  const [vacancySkillsById, setVacancySkillsById] = useState<Record<number, VacancySkill[]>>({});
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({ name: a.name, time_limit_min: a.time_limit_min, skills: a.skills });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

  const addFromVacancy = (vacancyId: number, skills: VacancySkill[]) => {
    setVacancySkillsById((prev) => ({ ...prev, [vacancyId]: skills }));
    const existing = new Set(fields.map((f) => f.skill_label).filter(Boolean));
    skills.forEach((s, i) => {
      if (existing.has(s.skill_label)) return;
      append({
        skill_id: s.skill_id,
        skill_label: s.skill_label,
        is_custom: false,
        expected_level: s.expected_level,
        display_order: fields.length + i,
        l1_anchor: s.l1_anchor,
        l2_anchor: s.l2_anchor,
        l3_anchor: s.l3_anchor,
        l4_anchor: s.l4_anchor,
        l5_anchor: s.l5_anchor,
      });
    });
  };

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
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: data.skills.map((s, i) => ({ ...s, display_order: i })),
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save.");
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
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from B7 taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setVacancyPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from Vacancy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom skill
            </Button>
          </div>
        </div>

        <Separator />
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/assessments/${id}/invite`)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} excludedLabels={fields.map((f) => f.skill_label).filter(Boolean)} />

      <VacancyPicker open={vacancyPickerOpen} onOpenChange={setVacancyPickerOpen} onSelect={addFromVacancy} fetchedSkills={vacancySkillsById} currentLabels={fields.map((f) => f.skill_label).filter(Boolean)} />
    </div>
  );
}
