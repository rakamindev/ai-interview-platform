import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [collapsed, setCollapsed] = useState(true);
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
        "rounded-lg border border-border bg-card text-card-foreground",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Card header */}
      <div className="flex cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-muted/30" role="button" tabIndex={0} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${skillLabel}`} onClick={() => setCollapsed((current) => !current)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setCollapsed((current) => !current); } }}>
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{skillLabel}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {isCustom ? "Custom" : skill?.skill_id ? `SK-${String(skill.skill_id).padStart(3, "0")}` : ""}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setCollapsed((current) => !current); }}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${skillLabel}`}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onRemove(); }}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove skill"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Card body */}
      {!collapsed && <div className="px-3 pb-3 space-y-3">
        {isCustom ? (
          <CustomSkillForm index={index} form={form} />
        ) : (
          <div className="space-y-3">
            {/* B7 skill: show anchors toggle */}
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {anchorsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {anchorsOpen ? "Hide L1–L5 anchors" : "Show L1–L5 anchors"}
            </button>

            {anchorsOpen && (
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded p-2">
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
              <span className="text-xs text-muted-foreground">Expected level:</span>
              <LevelRadio
                value={skill?.expected_level ?? 3}
                onChange={(v) => form.setValue(`skills.${index}.expected_level`, v, { shouldDirty: true, shouldValidate: true })}
              />
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
