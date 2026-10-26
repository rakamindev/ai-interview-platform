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
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2, AlertCircle, Clock, Zap, Layers } from "lucide-react";
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
        reset({
          name: a.name,
          time_limit_min: a.time_limit_min,
          language: (a as any).language || "en",
          skills: a.skills,
        });
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

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Please add at least one target skill to continue.");
      return;
    }
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-10 w-48 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-44 w-full rounded-3xl bg-slate-100 animate-pulse" />
        <div className="h-60 w-full rounded-3xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Breadcrumb & Header ── */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-500/20 bg-white/80 hover:bg-emerald-50/80 text-emerald-700 shadow-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Assessments</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-slate-500 font-medium">Edit Assessment</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Edit Assessment Template</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Form Card ── */}
        <div className="relative rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.10)] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Role & Protocol Parameters</h2>
              <p className="text-xs text-slate-500">Update position title and duration limit.</p>
            </div>
          </div>

          {/* Role title */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Role Title <span className="text-emerald-500">*</span>
            </label>
            <input
              id="name"
              {...register("name", { required: true })}
              className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all hover:border-emerald-300"
            />
          </div>

          {/* Time limit */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              Session Time Limit <span className="text-emerald-500">*</span>
            </label>
            <select
              value={String(watch("time_limit_min"))}
              onChange={(e) => setValue("time_limit_min", Number(e.target.value))}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all hover:border-emerald-300 cursor-pointer appearance-none w-full sm:w-56"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center'
              }}
            >
              {TIME_LIMIT_OPTIONS.map((min) => (
                <option key={min} value={min} className="bg-white text-slate-800">{min} minutes</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Skills Section ── */}
        <div className="relative rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 sm:p-8 space-y-5 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.10)] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-500" />

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Skills to Evaluate</h2>
                <p className="text-xs text-slate-500">Drag to reorder assessment priority.</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {fields.length} {fields.length === 1 ? "Skill" : "Skills"}
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed border-emerald-500/20 rounded-2xl p-8 text-center text-sm text-slate-500 bg-emerald-50/20">
              No skills added yet. Add at least one skill to continue.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => remove(index)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-50/50 hover:bg-emerald-100/60 text-xs font-semibold text-emerald-800 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600" /> Add from Skill Taxonomy
            </button>
            <button
              type="button"
              onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-slate-500" /> Add Custom Skill
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(`/assessments/${id}/invite`)}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.45)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} />
    </div>
  );
}
