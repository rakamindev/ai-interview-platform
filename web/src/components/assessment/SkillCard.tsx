import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import LevelRadio from "./LevelRadio";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface SkillCardProps {
  index: number;
  id: string;
  form: UseFormReturn<AssessmentFormValues>;
  onRemove: () => void;
  onEditCustom?: () => void;
}

export default function SkillCard({ index, id, form, onRemove, onEditCustom }: SkillCardProps) {
  const [anchorsOpen, setAnchorsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

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
        "rounded-2xl border bg-card shadow-sm",
        isDragging && "opacity-60 shadow-lg ring-2 ring-ring/30",
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Reorder ${skillLabel}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{skillLabel}</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground empty:hidden">
              {isCustom
                ? "Custom"
                : skill?.skill_id
                  ? `SK-${String(skill.skill_id).padStart(3, "0")}`
                  : ""}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove skill"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Card body */}
      <div className="space-y-3 px-4 pb-4">
        <div className="space-y-3">
          {isCustom && (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-xl text-xs text-muted-foreground">{skill?.scope_include}</p>
              {onEditCustom && (
                <Button type="button" variant="ghost" size="sm" onClick={onEditCustom}>
                  <Pencil /> Edit
                </Button>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              aria-expanded={anchorsOpen}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {anchorsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {anchorsOpen ? "Hide L1–L5 anchors" : "Show L1–L5 anchors"}
            </button>

            {anchorsOpen && (
              <div className="space-y-1.5 rounded-xl bg-rakamin-light-cyan/60 p-3 text-xs text-rakamin-charcoal">
                {[1, 2, 3, 4, 5].map((level) => {
                  const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                  return anchor ? (
                    <div key={level}>
                      <span className="mr-1 font-semibold text-primary">L{level}</span> {anchor}
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Expected level:</span>
              <LevelRadio
                value={skill?.expected_level ?? 3}
                onChange={(v) =>
                  form.setValue(`skills.${index}.expected_level`, v, { shouldDirty: true })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
