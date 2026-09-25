import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "./LevelRadio";
import { cn } from "@/lib/utils";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface SkillCardProps {
  index: number;
  id: string;
  form: UseFormReturn<AssessmentFormValues>;
  onRemove: () => void;
}

const LEVEL_CONFIG = [
  {
    level: 1,
    name: "Fundamental",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    placeholder: "e.g. Basic conceptual understanding, definitions, and awareness...",
  },
  {
    level: 2,
    name: "Novice",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    placeholder: "e.g. Practical execution of standard tasks with guided assistance...",
  },
  {
    level: 3,
    name: "Proficient",
    badge: "bg-[#01959F]/10 text-[#01959F] dark:text-teal-300 border-[#01959F]/30",
    placeholder: "e.g. Independent standard implementation and regular problem solving...",
  },
  {
    level: 4,
    name: "Advanced",
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    placeholder: "e.g. Complex troubleshooting, performance optimization, and edge case mastery...",
  },
  {
    level: 5,
    name: "Expert",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    placeholder: "e.g. Architectural strategy, domain authority, and setting technical standards...",
  },
] as const;

export default function SkillCard({ index, id, form, onRemove }: SkillCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const skill = useWatch({ control: form.control, name: `skills.${index}` });
  const isCustom = Boolean(skill?.is_custom || !skill?.skill_id);
  const skillLabel = skill?.skill_label || "";

  const [anchorsOpen, setAnchorsOpen] = useState(isCustom);
  const [isEditingTaxonomy, setIsEditingTaxonomy] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-xl bg-card p-3 sm:px-4 shadow-sm transition-all border-border/80 space-y-3",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20",
        anchorsOpen && "border-[#01959F]/40 shadow-md ring-1 ring-[#01959F]/10"
      )}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            className="cursor-grab text-muted-foreground/60 hover:text-foreground touch-none shrink-0"
            {...attributes}
            {...listeners}
            title="Drag to reorder priority"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              {isCustom ? (
                <div className="flex-1 max-w-sm">
                  <Input
                    placeholder="Enter custom skill name (e.g. System Design)"
                    className="h-8 text-sm font-semibold bg-background"
                    {...form.register(`skills.${index}.skill_label`, { required: true })}
                  />
                </div>
              ) : (
                <span className="font-semibold text-sm text-foreground truncate">
                  {skillLabel || "Skill"}
                </span>
              )}

              {isCustom ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  Custom
                </span>
              ) : skill?.skill_id ? (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  SK-{String(skill.skill_id).padStart(3, "0")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Target Competency Level for AI Evaluation
            </p>
          </div>
        </div>

        {/* Right Controls: Desktop side-by-side, Mobile wrapped nicely without overflowing */}
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0 justify-between sm:justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Level:</span>
            <LevelRadio
              value={skill?.expected_level ?? 3}
              onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAnchorsOpen((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors cursor-pointer",
                anchorsOpen
                  ? "bg-[#01959F]/10 text-[#01959F] dark:text-teal-300 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Toggle L1-L5 rubric descriptions"
            >
              {anchorsOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-[#01959F]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span>{isCustom ? (anchorsOpen ? "Hide Rubric" : "Define Rubric (L1–L5)") : (anchorsOpen ? "Hide Rubric" : "View Rubric (L1–L5)")}</span>
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Remove skill"
              title="Remove from assessment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Rubric Section (L1 - L5 Descriptions) */}
      {anchorsOpen && (
        <div className="pt-3 border-t border-border/60 space-y-3 bg-muted/20 -mx-3 -mb-3 p-3.5 sm:-mx-4 sm:-mb-4 sm:p-4 rounded-b-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Competency Rubric &amp; Level Descriptions (L1 – L5)
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isCustom
                  ? "Define performance criteria for each grade (L1–L5). AI evaluates candidate answers against these anchors."
                  : "Benchmark standards used by AI interviewer to score candidate performance across levels."}
              </p>
            </div>
            {!isCustom && (
              <button
                type="button"
                onClick={() => setIsEditingTaxonomy((prev) => !prev)}
                className="text-[11px] text-[#01959F] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {isEditingTaxonomy ? "Done Customizing" : "Customize Benchmark"}
              </button>
            )}
          </div>

          {isCustom || isEditingTaxonomy ? (
            <div className="space-y-2.5">
              {LEVEL_CONFIG.map(({ level, name, badge, placeholder }) => {
                const key = `l${level}_anchor` as const;
                return (
                  <div key={level} className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2.5">
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 sm:mt-1 sm:w-28 text-center w-fit sm:w-28 self-start sm:self-auto",
                        badge
                      )}
                    >
                      L{level} · {name}
                    </span>
                    <Textarea
                      rows={2}
                      placeholder={placeholder}
                      className="text-xs bg-background resize-y min-h-[44px]"
                      {...form.register(`skills.${index}.${key}`)}
                    />
                  </div>
                );
              })}

              {/* Optional Scope Inclusions */}
              <div className="pt-1.5 border-t border-border/40">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Scope &amp; Inclusions <span className="text-[10px] text-muted-foreground/70 font-normal">(Optional)</span>
                  </label>
                </div>
                <Input
                  placeholder="e.g. Practical system architecture, clean coding practices, and edge case handling..."
                  className="h-8 text-xs bg-background"
                  {...form.register(`skills.${index}.scope_include`)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {LEVEL_CONFIG.map(({ level, name, badge }) => {
                const anchorText = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
                return (
                  <div
                    key={level}
                    className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2.5 p-2 rounded-lg bg-background/80 border border-border/40"
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 sm:mt-0.5 sm:w-28 text-center w-fit sm:w-28 self-start sm:self-auto",
                        badge
                      )}
                    >
                      L{level} · {name}
                    </span>
                    <p className="text-xs text-foreground/90 leading-relaxed flex-1">
                      {anchorText || (
                        <span className="italic text-muted-foreground">
                          Default competency benchmark applies.
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
