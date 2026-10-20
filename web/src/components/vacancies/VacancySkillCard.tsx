import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LevelRadio from "@/components/assessment/LevelRadio";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { X, ChevronDown, ChevronRight, Plus, Check, Loader2 } from "lucide-react";

interface VacancySkillCardProps {
  index: number;
  form: UseFormReturn<any>;
  onRemove: () => void;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "Fundamental conceptual understanding of this competency...",
  2: "Practical hands-on implementation and pattern application...",
  3: "Autonomous production problem-solving and optimization...",
  4: "Advanced architectural design and technical leadership...",
  5: "Industry-level mastery, innovation, and strategic direction...",
};

export default function VacancySkillCard({ index, form, onRemove }: VacancySkillCardProps) {
  const { register, setValue, watch } = form;
  const isCustom = watch(`skills.${index}.is_custom`);
  const skillLabel = watch(`skills.${index}.skill_label`);
  const [anchorsOpen, setAnchorsOpen] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [savedLibrary, setSavedLibrary] = useState(Boolean(watch(`skills.${index}.skill_id`)));

  const handleSaveToLibrary = async () => {
    const label = watch(`skills.${index}.skill_label`);
    if (!label?.trim()) return;

    setSavingLibrary(true);
    try {
      const res = await skillTaxonomiesApi.create({
        skill_label: label.trim(),
        category: watch(`skills.${index}.category`) || "engineering",
        scope_include: watch(`skills.${index}.scope_include`)?.trim() || undefined,
        scope_exclude: watch(`skills.${index}.scope_exclude`)?.trim() || undefined,
        l1_anchor: watch(`skills.${index}.l1_anchor`)?.trim() || undefined,
        l2_anchor: watch(`skills.${index}.l2_anchor`)?.trim() || undefined,
        l3_anchor: watch(`skills.${index}.l3_anchor`)?.trim() || undefined,
        l4_anchor: watch(`skills.${index}.l4_anchor`)?.trim() || undefined,
        l5_anchor: watch(`skills.${index}.l5_anchor`)?.trim() || undefined,
      });

      if (res.data?.skill?.skill_id) {
        setValue(`skills.${index}.skill_id`, res.data.skill.skill_id);
      }
      setSavedLibrary(true);
    } catch (err) {
      console.warn("Failed to save competency to library:", err);
    } finally {
      setSavingLibrary(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-white">
      {isCustom ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Custom</Badge>
              <span className="text-xs font-medium text-foreground">Custom Competency Requirement</span>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Remove skill"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`skills.${index}.skill_label`} className="text-xs">
              Competency Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`skills.${index}.skill_label`}
              placeholder="e.g. Distributed Consensus, Domain-Driven Design"
              {...register(`skills.${index}.skill_label`, { required: true })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select
                value={watch(`skills.${index}.category`) || "engineering"}
                onValueChange={(val) => setValue(`skills.${index}.category`, val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="problem_solving">Problem Solving</SelectItem>
                  <SelectItem value="domain_knowledge">Domain Knowledge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Target Expected Level (L1–L5)</Label>
              <LevelRadio
                value={watch(`skills.${index}.expected_level`) ?? 3}
                onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`skills.${index}.scope_include`} className="text-xs">
              What counts (scope include)
            </Label>
            <Textarea
              id={`skills.${index}.scope_include`}
              placeholder="Key concepts, architecture expectations, or frameworks to evaluate..."
              rows={2}
              className="text-xs"
              {...register(`skills.${index}.scope_include`)}
            />
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => setAnchorsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              {anchorsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {anchorsOpen ? "Hide Proficiency Rubric Anchors (L1–L5)" : "Configure Proficiency Rubric Anchors (L1–L5)"}
            </button>

            {anchorsOpen && (
              <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Rubric anchors calibrate the AI interviewer during live adaptive probing. Leave blank to auto-generate standard anchors.
                </p>
                {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((key, i) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-[11px] font-medium text-foreground">
                      L{i + 1} Anchor (Level {i + 1})
                    </Label>
                    <Textarea
                      rows={1}
                      className="text-xs"
                      placeholder={LEVEL_PLACEHOLDERS[i + 1]}
                      {...register(`skills.${index}.${key}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <span className="text-muted-foreground text-[11px]">
              {savedLibrary
                ? "Saved to Skill Library"
                : "Will be automatically saved to Skill Library when vacancy is saved."}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={savingLibrary || savedLibrary}
              onClick={handleSaveToLibrary}
              className="h-7 text-xs text-primary hover:text-primary"
            >
              {savingLibrary ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : savedLibrary ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-green-600" />
                  In Skill Library
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Save to Skill Library Now
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{skillLabel}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {watch(`skills.${index}.skill_id`) ? `SK-${watch(`skills.${index}.skill_id`)}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Remove skill"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Expected level:</span>
            <LevelRadio
              value={watch(`skills.${index}.expected_level`) ?? 3}
              onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
