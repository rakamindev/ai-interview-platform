import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight, Pencil, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LevelRadio from "./LevelRadio";
import { cn } from "@/lib/utils";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface SkillCardProps {
  index: number;
  id: string;
  form: UseFormReturn<AssessmentFormValues>;
  onRemove: () => void;
  onEdit?: () => void;
}

export default function SkillCard({ index, id, form, onRemove, onEdit }: SkillCardProps) {
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
        "border border-slate-200/90 rounded-xl bg-white shadow-xs transition-shadow",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="cursor-grab text-slate-400 hover:text-slate-700 touch-none p-0.5 rounded"
            {...attributes}
            {...listeners}
            aria-label="Reorder skill"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-slate-900 truncate">{skillLabel}</span>
            {isCustom ? (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 shrink-0 flex items-center gap-1 font-medium">
                <Sparkles className="h-2.5 w-2.5" /> Custom
              </Badge>
            ) : skill?.skill_id ? (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500 shrink-0 font-normal">
                SK-{String(skill.skill_id).padStart(3, "0")}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isCustom && onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
            >
              <Pencil className="h-3 w-3 mr-1 text-slate-500" /> Edit Rubric
            </Button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-400 hover:text-destructive p-1 rounded-md hover:bg-rose-50 transition-colors"
            aria-label="Remove skill"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3.5">
        {skill?.scope_include && (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
            <span className="font-semibold text-slate-700">Scope: </span>
            {skill.scope_include}
          </p>
        )}

        {/* Anchors collapsible view */}
        <div>
          <button
            type="button"
            onClick={() => setAnchorsOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {anchorsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {anchorsOpen ? "Hide L1–L5 Rubrics" : "View L1–L5 Rubrics"}
          </button>

          {anchorsOpen && (
            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 mt-2">
              {[1, 2, 3, 4, 5].map((level) => {
                const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                return anchor ? (
                  <div key={level} className="flex gap-2">
                    <span className="font-bold text-slate-900 shrink-0 w-6">L{level}:</span>
                    <span className="text-slate-700 leading-relaxed">{anchor}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Expected Level */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-700 block">Target Expected Level:</span>
          <LevelRadio
            value={skill?.expected_level ?? 3}
            onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
          />
        </div>
      </div>
    </div>
  );
}
