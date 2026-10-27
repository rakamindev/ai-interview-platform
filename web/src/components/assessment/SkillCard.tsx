import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight, Sparkles, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        "border border-slate-200/80 rounded-2xl bg-white shadow-xs transition-all",
        isDragging ? "opacity-60 shadow-lg border-teal-500 scale-[1.01]" : "hover:border-slate-300"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 rounded-t-2xl border-b border-slate-100">
        <button
          type="button"
          className="cursor-grab text-slate-400 hover:text-slate-700 touch-none p-1 rounded-md hover:bg-slate-200/60 transition-colors"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 truncate">{skillLabel}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] py-0 px-2 font-mono font-medium",
                isCustom
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-teal-50 text-teal-700 border-teal-200"
              )}
            >
              {isCustom ? "Custom Skill" : skill?.skill_id ? `SK-${String(skill.skill_id).padStart(3, "0")}` : "B7 Taxonomy"}
            </Badge>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-rose-50"
          aria-label="Remove skill"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3.5">
        {isCustom ? (
          <CustomSkillForm index={index} form={form} />
        ) : (
          <div className="space-y-3">
            {/* B7 skill: show anchors toggle */}
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors"
            >
              {anchorsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {anchorsOpen ? "Sembunyikan Panduan Anchor L1–L5" : "Lihat Panduan Anchor L1–L5"}
            </button>

            {anchorsOpen && (
              <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 border border-slate-200/70 rounded-xl p-3 animate-in fade-in duration-200">
                {[1, 2, 3, 4, 5].map((level) => {
                  const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                  return anchor ? (
                    <div key={level} className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 bg-white border border-slate-200 px-1.5 py-0.2 rounded text-[10px] shrink-0">
                        L{level}
                      </span>
                      <span className="leading-relaxed">{anchor}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-600">Target Level yang Diharapkan:</span>
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
