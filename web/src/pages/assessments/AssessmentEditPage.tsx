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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import CustomSkillModal from "@/components/assessment/CustomSkillModal";
import { ArrowLeft, Plus, Loader2, Clock, Sparkles, Layers, BookOpen, AlertCircle } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS, LEVEL_LABELS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [editingSkillIndex, setEditingSkillIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, language: "en", skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, watch, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({ name: a.name, time_limit_min: a.time_limit_min, language: a.language ?? "en", skills: a.skills });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

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

  const handleOpenAddCustomSkill = () => {
    setEditingSkillIndex(null);
    setCustomModalOpen(true);
  };

  const handleOpenEditCustomSkill = (index: number) => {
    setEditingSkillIndex(index);
    setCustomModalOpen(true);
  };

  const handleSaveCustomSkill = (skillData: Partial<AssessmentSkill>) => {
    if (editingSkillIndex !== null) {
      setValue(`skills.${editingSkillIndex}`, {
        ...fields[editingSkillIndex],
        ...skillData,
      });
    } else {
      append({
        ...skillData,
        display_order: fields.length,
      });
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
        language: data.language,
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
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const name = watch("name");
  const timeLimit = watch("time_limit_min");
  const skills = watch("skills") || [];

  const isFormValid =
    Boolean(name?.trim()) &&
    skills.length > 0 &&
    skills.every(
      (s) =>
        !s.is_custom ||
        (Boolean(s.skill_label?.trim()) &&
          Boolean(s.scope_include?.trim()) &&
          Boolean(s.l1_anchor?.trim()) &&
          Boolean(s.l2_anchor?.trim()) &&
          Boolean(s.l3_anchor?.trim()) &&
          Boolean(s.l4_anchor?.trim()) &&
          Boolean(s.l5_anchor?.trim()))
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-28 sm:pb-8">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          title="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Link to="/assessments" className="hover:text-foreground">Assessments</Link>
            <span>/</span>
            <Link to={`/assessments/${id}/invite`} className="hover:text-foreground">{name || "Detail"}</Link>
            <span>/</span>
            <span className="text-slate-900">Edit</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Edit Assessment
          </h1>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to save changes</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Form and Preview Grid ── */}
      <form id="assessment-edit-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ── Left Column: Form Cards (2 cols on lg) ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: General Information */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900">
                1. General Information
              </CardTitle>
              <CardDescription className="text-xs">
                Role title and session duration
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-900">
                  Role Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  className="h-10 text-sm"
                  {...register("name", { required: "Role title is required" })}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  Session Time Limit <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={String(watch("time_limit_min"))}
                  onValueChange={(v) => setValue("time_limit_min", Number(v))}
                >
                  <SelectTrigger className="h-10 sm:w-64">
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
            </CardContent>
          </Card>

          {/* Card 2: Skills to Assess */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  2. Skills &amp; Competencies <span className="text-destructive">*</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Reorder or configure expectations for each skill
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {fields.length} skill{fields.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {fields.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center space-y-3 bg-slate-50/40">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">No skills configured</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add at least one competency to save this assessment.
                    </p>
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
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <SkillCard
                          key={field.id}
                          id={field.id}
                          index={index}
                          form={form}
                          onRemove={() => remove(index)}
                          onEdit={() => handleOpenEditCustomSkill(index)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div className="flex flex-wrap gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 bg-white shadow-xs"
                  onClick={() => setPickerOpen(true)}
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Add from Skill Taxonomy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 bg-white shadow-xs"
                  onClick={handleOpenAddCustomSkill}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  Add Custom Skill
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Summary & Actions (1 col on lg) ── */}
        <div className="space-y-6">
          <Card className="border-slate-200/80 shadow-xs sticky top-20">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Assessment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Role Name</span>
                <p className="font-semibold text-slate-900 text-base">
                  {name?.trim() || <span className="text-muted-foreground font-normal italic">Untitled</span>}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="text-muted-foreground block">Duration</span>
                <span className="font-semibold text-slate-800">{timeLimit} mins</span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">
                  Configured Skills ({skills.length})
                </span>
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Add at least one skill.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {skills.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                        <span className="truncate pr-2 text-slate-700 font-medium">
                          {s.skill_label || `Custom Skill #${idx + 1}`}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {LEVEL_LABELS[s.expected_level ?? 3]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop action buttons */}
              <div className="pt-4 border-t border-slate-100 hidden sm:flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-10 shadow-sm"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-slate-500 hover:text-slate-900"
                  onClick={() => navigate(`/assessments/${id}/invite`)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </form>

      {/* ── Mobile sticky action bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex gap-2" style={{ bottom: "64px" }}>
        <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => navigate(`/assessments/${id}/invite`)}>
          Cancel
        </Button>
        <Button form="assessment-edit-form" type="submit" className="flex-1 h-10 bg-primary text-white font-semibold" disabled={!isFormValid || submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ ...s, display_order: fields.length })}
      />

      <CustomSkillModal
        open={customModalOpen}
        onOpenChange={setCustomModalOpen}
        initialData={editingSkillIndex !== null ? fields[editingSkillIndex] : null}
        onSave={handleSaveCustomSkill}
      />
    </div>
  );
}
