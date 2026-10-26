import { UseFormReturn, useWatch } from "react-hook-form";
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
  const { register, setValue } = form;
  const expectedLevel = useWatch({ control: form.control, name: `skills.${index}.expected_level` });

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <label htmlFor={`skills.${index}.skill_label`} className="block text-xs font-semibold text-slate-700 tracking-wide">
          Skill Name <span className="text-emerald-500">*</span>
        </label>
        <input
          id={`skills.${index}.skill_label`}
          placeholder="e.g. Communication, System Design"
          {...register(`skills.${index}.skill_label`, { required: true })}
          className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all hover:border-emerald-300"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`skills.${index}.scope_include`} className="block text-xs font-semibold text-slate-700 tracking-wide">
          What counts (scope include) <span className="text-emerald-500">*</span>
        </label>
        <textarea
          id={`skills.${index}.scope_include`}
          placeholder="Clear technical explanation, stakeholder alignment, async written communication..."
          rows={2}
          {...register(`skills.${index}.scope_include`, { required: true })}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all hover:border-emerald-300 resize-none"
        />
      </div>

      <div className="space-y-2.5">
        <span className="block text-xs font-semibold text-slate-700 tracking-wide">
          Level Behavioral Anchors <span className="text-emerald-500">*</span>
        </span>
        {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((key, i) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`skills.${index}.${key}`} className="block text-[11px] font-medium text-slate-500">
              Level {i + 1} Anchor
            </label>
            <textarea
              id={`skills.${index}.${key}`}
              placeholder={LEVEL_PLACEHOLDERS[i + 1]}
              rows={2}
              {...register(`skills.${index}.${key}`, { required: true })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all hover:border-emerald-300 resize-none"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-1 border-t border-slate-100">
        <label className="block text-xs font-semibold text-slate-700 tracking-wide">Expected Benchmark Level</label>
        <LevelRadio
          value={expectedLevel ?? 3}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
        />
      </div>
    </div>
  );
}
