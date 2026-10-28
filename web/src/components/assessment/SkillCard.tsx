import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LevelRadio from "./LevelRadio";
import CustomSkillForm from "./CustomSkillForm";
import { cn } from "@/lib/utils";
import { LEVEL_TIERS } from "./LevelRadio";
import type { AssessmentFormValues } from "@/types";

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
  const currentLevel = skill?.expected_level ?? 3;
  const tier = LEVEL_TIERS[currentLevel];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-white shadow-xs overflow-hidden",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/30"
      )}
    >
      {/* Card Header: drag handle + name + level badge */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50/60 border-b border-slate-100">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate">{skillLabel}</span>
            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
              {isCustom ? "Custom" : skill?.skill_id ? `SK-${skill.skill_id}` : ""}
            </span>
          </div>
        </div>

        {/* Level badge indicator (Point 5) */}
        {!isCustom && tier && (
          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full shrink-0">
            {tier.name}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="px-3 pb-3 pt-2 space-y-3">
        {isCustom ? (
          <CustomSkillForm index={index} form={form} />
        ) : (
          <div className="space-y-3">
            {/* Anchor toggle */}
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {anchorsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {anchorsOpen ? "Hide L1–L5 anchors" : "Show L1–L5 anchors"}
            </button>

            {anchorsOpen && (
              <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/50 rounded-lg p-3 border border-slate-200/60">
                {[1, 2, 3, 4, 5].map((level) => {
                  const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                  const t = LEVEL_TIERS[level];
                  return anchor ? (
                    <div key={level} className="flex gap-1.5">
                      <span className="font-semibold text-slate-700 shrink-0 w-16">
                        {t.code} ({t.name}):
                      </span>
                      <span className="text-slate-600">{anchor}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {/* Expected level with Beginner–Expert labels */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Expected Level:</span>
              <LevelRadio
                value={currentLevel}
                onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
                detailed={true}
              />
            </div>
          </div>
        )}

        {/* Delete button at the BOTTOM of the card (Note #4) */}
        <div className="flex justify-end pt-2 border-t border-slate-100 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-destructive hover:bg-rose-50 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete Skill
          </Button>
        </div>
      </div>
    </div>
  );
}
