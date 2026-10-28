import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LevelRadio from "./LevelRadio";
import { LEVEL_TIERS } from "./LevelRadio";
import { ChevronDown, ChevronRight, Check, Pencil, Lock } from "lucide-react";
import type { AssessmentFormValues } from "@/types";

interface CustomSkillFormProps {
  index: number;
  form: UseFormReturn<AssessmentFormValues>;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "Beginner — basic awareness, can define but not yet applied independently.",
  2: "Junior — limited hands-on experience, needs guidance.",
  3: "Mid-level — independently applies with standard proficiency.",
  4: "Senior — leads application, handles edge cases, guides peers.",
  5: "Expert — mastery-level, shapes strategy, industry authority.",
};

export default function CustomSkillForm({ index, form }: CustomSkillFormProps) {
  const { register, setValue } = form;
  const skill = useWatch({ control: form.control, name: `skills.${index}` });
  const expectedLevel = skill?.expected_level ?? 3;
  const skillLabel = skill?.skill_label;
  const scopeInclude = skill?.scope_include;

  // Note #2 & Note #3:
  // Compact / saved state so user can fix in the description with a save button
  const [isSaved, setIsSaved] = useState(false);
  const [anchorsOpen, setAnchorsOpen] = useState(false);

  // If already saved and user has provided a label, show compact locked view
  if (isSaved && skillLabel) {
    const tier = LEVEL_TIERS[expectedLevel];
    return (
      <div className="space-y-2 pt-1 pb-1">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="space-y-1 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 truncate">{skillLabel}</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                <Check className="w-2.5 h-2.5 mr-1 text-emerald-600" /> Details Saved
              </Badge>
            </div>
            {scopeInclude && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {scopeInclude}
              </p>
            )}
            <div className="text-[11px] text-primary font-medium">
              Expected: {tier?.code} ({tier?.name})
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => setIsSaved(false)}
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Skill Name */}
      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.skill_label`} className="text-xs font-semibold">
          Skill Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`skills.${index}.skill_label`}
          placeholder="e.g. Communication, System Design, SQL Proficiency"
          className="text-sm"
          {...register(`skills.${index}.skill_label`, { required: true })}
        />
      </div>

      {/* Scope Include */}
      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.scope_include`} className="text-xs font-semibold">
          What counts (scope description) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id={`skills.${index}.scope_include`}
          placeholder="e.g. Clear written/verbal communication, stakeholder alignment, async documentation..."
          rows={2}
          className="text-sm resize-none"
          {...register(`skills.${index}.scope_include`, { required: true })}
        />
      </div>

      {/* Expected Level */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Expected Level</Label>
        <LevelRadio
          value={expectedLevel}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
          detailed={true}
        />
      </div>

      {/* L1–L5 Anchor Descriptions: collapsed by default (Note #2) */}
      <div className="border border-slate-200/60 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setAnchorsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            {anchorsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            Level Anchors (L1–L5 Descriptors)
          </span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {anchorsOpen ? "Hide" : "Expand to define each level"}
          </span>
        </button>

        {anchorsOpen && (
          <div className="p-3 space-y-2 bg-white border-t border-slate-200/60">
            <p className="text-[11px] text-muted-foreground mb-2">
              Define what each proficiency level looks like for this skill. Required for AI assessment calibration.
            </p>
            {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map(
              (key, i) => {
                const level = i + 1;
                const t = LEVEL_TIERS[level];
                return (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`skills.${index}.${key}`} className="text-xs font-semibold text-slate-700">
                      {t.code} – {t.name} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`skills.${index}.${key}`}
                      placeholder={LEVEL_PLACEHOLDERS[level]}
                      rows={2}
                      className="text-xs resize-none"
                      {...register(`skills.${index}.${key}`, { required: anchorsOpen })}
                    />
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Note #3: Save button to fix & lock description */}
      <div className="flex justify-end pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5 font-medium"
          onClick={() => {
            if (skillLabel) {
              setIsSaved(true);
            }
          }}
          disabled={!skillLabel}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          Save Skill Details
        </Button>
      </div>
    </div>
  );
}
