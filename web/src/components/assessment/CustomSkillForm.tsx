import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "./LevelRadio";
import { LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface CustomSkillFormProps {
  index: number;
  form: UseFormReturn<AssessmentFormValues>;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "Describes foundational knowledge, basic syntax, and routine execution under guidance...",
  2: "Describes practical ability to build standard features independently with basic unit tests...",
  3: "Describes autonomous end-to-end execution on complex tasks, production problem solving...",
  4: "Describes advanced architectural decisions, performance optimization, and best practices...",
  5: "Describes domain leadership, strategic innovation, and driving standards across teams...",
};

const ANCHOR_KEYS = ["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const;

export default function CustomSkillForm({ index, form }: CustomSkillFormProps) {
  const { register, setValue } = form;
  const [activeTab, setActiveTab] = useState<number>(3); // Default to L3
  const expectedLevel = useWatch({ control: form.control, name: `skills.${index}.expected_level` });
  const watchedValues = useWatch({ control: form.control, name: `skills.${index}` });

  return (
    <div className="space-y-5">
      {/* Skill Name & Scope - Clean 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor={`skills.${index}.skill_label`} className="text-xs font-semibold text-foreground">
            Skill Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`skills.${index}.skill_label`}
            placeholder="e.g. System Design, Communication, React Architecture"
            className="text-sm h-10"
            {...register(`skills.${index}.skill_label`, { required: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`skills.${index}.scope_include`} className="text-xs font-semibold text-foreground">
            What counts (Scope include) <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`skills.${index}.scope_include`}
            placeholder="e.g. Clear technical explanations, stakeholder alignment, documentation"
            className="text-sm h-10"
            {...register(`skills.${index}.scope_include`, { required: true })}
          />
        </div>
      </div>

      {/* Expected Minimum Level - Clean, no divider line */}
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
          value={expectedLevel ?? 3}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
        />
      </div>

      {/* L1 - L5 Behavioral Anchors - Tabbed editor, no divider line */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-foreground block">
              Proficiency Behavioral Anchors (L1 – L5)
            </span>
            <span className="text-xs text-muted-foreground">
              Define concrete behavioral criteria expected at each level
            </span>
          </div>

          {/* Level Tabs */}
          <div className="inline-flex border bg-muted/20 p-0.5 gap-0.5 self-start sm:self-auto">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const key = ANCHOR_KEYS[lvl - 1];
              const hasContent = Boolean(watchedValues?.[key]);
              const isActive = activeTab === lvl;

              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setActiveTab(lvl)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 select-none cursor-pointer",
                    isActive
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>L{lvl}</span>
                  {hasContent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Textarea (all 5 remain in DOM for react-hook-form) */}
        <div>
          {ANCHOR_KEYS.map((key, i) => {
            const lvl = i + 1;
            const isVisible = activeTab === lvl;

            return (
              <div key={key} className={isVisible ? "space-y-1.5" : "hidden"}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    L{lvl} ({LEVEL_DESCRIPTIONS[lvl]}) Anchor Definition:
                  </span>
                  <span className="text-muted-foreground">
                    Tab {lvl} of 5
                  </span>
                </div>
                <Textarea
                  id={`skills.${index}.${key}`}
                  placeholder={LEVEL_PLACEHOLDERS[lvl]}
                  rows={3}
                  className="text-xs leading-relaxed"
                  {...register(`skills.${index}.${key}`, { required: true })}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
