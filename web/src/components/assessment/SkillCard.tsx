import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight } from "lucide-react";
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
  const skillLabel = skill?.skill_label || "New skill";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Reorder ${skillLabel}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="break-words text-sm font-medium">{skillLabel}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {isCustom ? "Custom" : skill?.skill_id ? `SK-${String(skill.skill_id).padStart(3, "0")}` : ""}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Remove ${skillLabel}`}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {/* Card body */}
      <div className="space-y-3 px-3 pb-4">
        {isCustom ? (
          <CustomSkillForm index={index} form={form} />
        ) : (
          <div className="space-y-3">
            {/* Taxonomy skill: show anchors toggle */}
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              aria-expanded={anchorsOpen}
              className="flex min-h-11 items-center gap-1 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {anchorsOpen ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
              {anchorsOpen ? "Hide L1 to L5 anchors" : "Show L1 to L5 anchors"}
            </button>

            {anchorsOpen && (
              <div className="space-y-1 rounded bg-muted/50 p-3 text-sm text-muted-foreground">
                {[1, 2, 3, 4, 5].map((level) => {
                  const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                  return anchor ? (
                    <div key={level}>
                      <span className="font-medium text-foreground">L{level}</span> {anchor}
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Expected level</span>
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
