import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight } from "lucide-react";
import LevelRadio from "./LevelRadio";
import CustomSkillForm from "./CustomSkillForm";
import { LEVEL_DESCRIPTIONS } from "@/utils/constants";
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
  const skillLabel = skill?.skill_label || (isCustom ? "New Custom Skill" : "Selected Skill");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border bg-card p-6 md:p-7 space-y-5 transition-shadow",
        isDragging && "opacity-60 shadow-lg ring-1 ring-primary"
      )}
    >
      {/* Top Header Row - Clean and open, no divider line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground touch-none p-1 -ml-1 transition-colors"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <h3 className="font-bold text-base md:text-lg text-foreground truncate">
            {skillLabel}
          </h3>

          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border select-none shrink-0",
              isCustom
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-primary/30 bg-primary/10 text-primary"
            )}
          >
            {isCustom ? "Custom" : "Taxonomy"}
          </span>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
          title="Remove skill"
          aria-label="Remove skill"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Card Content */}
      {isCustom ? (
        <CustomSkillForm index={index} form={form} />
      ) : (
        <div className="space-y-4">
          {/* Scope Definition - Clean text without line */}
          {skill?.scope_include && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="font-semibold text-foreground">Scope: </strong>
              {skill.scope_include}
            </p>
          )}

          {/* Expected Level Selector Row - Clean without line */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Expected Minimum Level:
              </span>
              <span className="text-xs text-muted-foreground">
                Required baseline rating for candidate evaluation
              </span>
            </div>
            <LevelRadio
              value={skill?.expected_level ?? 3}
              onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
            />
          </div>

          {/* Collapsible Anchors Details - 5 horizontal cards instead of vertical striped lines */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer select-none"
            >
              {anchorsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {anchorsOpen ? "Hide proficiency anchors (L1–L5)" : "View proficiency anchors (L1–L5)"}
            </button>

            {anchorsOpen && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const anchor = skill?.[`l${lvl}_anchor` as keyof typeof skill] as string;
                  if (!anchor) return null;
                  const isTarget = (skill?.expected_level ?? 3) === lvl;

                  return (
                    <div
                      key={lvl}
                      onClick={() => form.setValue(`skills.${index}.expected_level`, lvl)}
                      className={cn(
                        "p-3.5 text-xs space-y-1.5 cursor-pointer transition-colors border",
                        isTarget
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("font-bold", isTarget ? "text-primary" : "text-foreground")}>
                          L{lvl} {LEVEL_DESCRIPTIONS[lvl]}
                        </span>
                        {isTarget && (
                          <span className="text-[9px] font-semibold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 shrink-0">
                            Target
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed text-[11px]">
                        {anchor}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
