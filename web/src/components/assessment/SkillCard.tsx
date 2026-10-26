import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import LevelRadio from "./LevelRadio";
import CustomSkillForm from "./CustomSkillForm";
import { cn } from "@/lib/utils";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface SkillCardProps {
  index: number;
  id: string;
  form: UseFormReturn<AssessmentFormValues>;
  onRemove: () => void;
}

export default function SkillCard({ index, id, form, onRemove }: SkillCardProps) {
  const [anchorsOpen, setAnchorsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const skill = useWatch({ control: form.control, name: `skills.${index}` });
  const isCustom = skill?.is_custom;
  const skillLabel = skill?.skill_label || "New Skill";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-2xl border border-emerald-500/20 bg-white shadow-sm transition-all hover:border-emerald-500/40 hover:shadow-md",
        isDragging && "opacity-60 shadow-xl border-emerald-500 ring-2 ring-emerald-500/20"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
        <button
          type="button"
          className="cursor-grab text-slate-300 hover:text-emerald-600 touch-none transition-colors p-0.5"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate text-slate-800">{skillLabel}</span>
            <span className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded-full font-medium shrink-0",
              isCustom
                ? "bg-purple-50 text-purple-700 border border-purple-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            )}>
              {isCustom ? "Custom" : skill?.skill_id ? `SK-${String(skill.skill_id).padStart(3, "0")}` : "Standard"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
          aria-label="Remove skill"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Card body */}
      <div className="px-4 py-3.5 space-y-3.5">
        {isCustom ? (
          <CustomSkillForm index={index} form={form} />
        ) : (
          <div className="space-y-3">
            {/* Scope include preview if present */}
            {skill?.scope_include && (
              <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-medium text-slate-700">Scope:</span> {skill.scope_include}
              </p>
            )}

            {/* B7 skill: show anchors toggle */}
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              {anchorsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {anchorsOpen ? "Hide L1–L5 Rubric Details" : "View L1–L5 Rubric Details"}
            </button>

            {anchorsOpen && (
              <div className="text-xs text-slate-600 space-y-1.5 bg-emerald-50/40 border border-emerald-500/15 rounded-xl p-3">
                {[1, 2, 3, 4, 5].map((level) => {
                  const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                  return anchor ? (
                    <div key={level} className="flex gap-2">
                      <span className="font-bold text-emerald-700 shrink-0">L{level}:</span>
                      <span className="text-slate-600 leading-relaxed">{anchor}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-700 tracking-wide">Target Benchmark Level:</span>
              <LevelRadio
                value={skill?.expected_level ?? 3}
                onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
