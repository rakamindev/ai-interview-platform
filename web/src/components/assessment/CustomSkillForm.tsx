import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { skillTaxonomiesApi, type SkillTaxonomySuggestion } from "@/services/skillTaxonomies";
import LevelRadio from "./LevelRadio";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

interface CustomSkillFormProps {
  index: number;
  form: UseFormReturn<AssessmentFormValues>;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "What does L1 look like for this skill?",
  2: "What does L2 look like for this skill?",
  3: "What does L3 look like for this skill?",
  4: "What does L4 look like for this skill?",
  5: "What does L5 look like for this skill?",
};

export default function CustomSkillForm({ index, form }: CustomSkillFormProps) {
  const { register, setValue, getValues, formState: { errors } } = form;
  const expectedLevel = useWatch({ control: form.control, name: `skills.${index}.expected_level` });
  const [checking, setChecking] = useState(false);
  const [suggestion, setSuggestion] = useState<SkillTaxonomySuggestion | null | undefined>(undefined);

  const checkSimilar = async () => {
    const label = getValues(`skills.${index}.skill_label`);
    if (!label?.trim()) return;
    setChecking(true);
    setSuggestion(undefined);
    try {
      const res = await skillTaxonomiesApi.suggest(label.trim());
      setSuggestion(res.data.suggestion);
    } catch {
      setSuggestion(null);
    } finally {
      setChecking(false);
    }
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    setValue(`skills.${index}.is_custom`, false);
    setValue(`skills.${index}.skill_id`, suggestion.skill_id);
    setValue(`skills.${index}.skill_label`, suggestion.skill_label);
    setValue(`skills.${index}.scope_include`, suggestion.scope_include);
    setValue(`skills.${index}.scope_exclude`, suggestion.scope_exclude);
    setValue(`skills.${index}.l1_anchor`, suggestion.l1_anchor);
    setValue(`skills.${index}.l2_anchor`, suggestion.l2_anchor);
    setValue(`skills.${index}.l3_anchor`, suggestion.l3_anchor);
    setValue(`skills.${index}.l4_anchor`, suggestion.l4_anchor);
    setValue(`skills.${index}.l5_anchor`, suggestion.l5_anchor);
    setSuggestion(undefined);
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.skill_label`}>
          Name <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id={`skills.${index}.skill_label`}
            placeholder="e.g. Communication"
            className="flex-1"
            {...register(`skills.${index}.skill_label`, { required: true })}
          />
          <Button type="button" variant="outline" size="sm" onClick={checkSimilar} disabled={checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Cek skill serupa
          </Button>
        </div>

        {suggestion === null && (
          <p className="text-xs text-muted-foreground">
            Tidak ada skill taxonomy yang cukup mirip — lanjut isi manual.
          </p>
        )}

        {suggestion && (
          <div className="text-xs bg-primary/5 border border-primary/20 rounded-md p-2.5 space-y-1.5">
            <p>
              Skill serupa ditemukan: <span className="font-medium">{suggestion.skill_label}</span>{" "}
              <span className="text-muted-foreground">({suggestion.confidence} confidence)</span>
            </p>
            <p className="text-muted-foreground">{suggestion.reasoning}</p>
            <div className="flex gap-2 pt-0.5">
              <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={useSuggestion}>
                <Check className="h-3 w-3 mr-1" /> Pakai skill ini
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSuggestion(undefined)}>
                Tetap custom
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.scope_include`}>
          What counts (scope include) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id={`skills.${index}.scope_include`}
          placeholder="Clear technical explanation, stakeholder alignment, async written communication..."
          rows={2}
          {...register(`skills.${index}.scope_include`, { required: true })}
        />
      </div>

      <div className="space-y-2">
        {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((key, i) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`skills.${index}.${key}`}>
              L{i + 1} anchor <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`skills.${index}.${key}`}
              placeholder={LEVEL_PLACEHOLDERS[i + 1]}
              rows={2}
              {...register(`skills.${index}.${key}`, { required: true })}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Expected level</Label>
        <LevelRadio
          value={expectedLevel ?? 3}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
        />
      </div>
    </div>
  );
}
