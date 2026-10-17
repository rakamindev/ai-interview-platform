import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const { register, setValue, formState: { errors } } = form;
  const expectedLevel = useWatch({ control: form.control, name: `skills.${index}.expected_level` });

  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.skill_label`} className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Nama Skill / Rubrik <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`skills.${index}.skill_label`}
          placeholder="Contoh: Technical Communication, System Design, QA Automation..."
          className="h-11 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white text-sm font-semibold transition-all"
          {...register(`skills.${index}.skill_label`, { required: true })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`skills.${index}.scope_include`} className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Ruang Lingkup Kompetensi (Scope Include) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id={`skills.${index}.scope_include`}
          placeholder="Jelaskan apa yang dinilai: pemahaman konsep arsitektur, komunikasi teknis ke stakeholder, penanganan insiden..."
          rows={2}
          className="rounded-xl p-3 text-sm bg-slate-50/50 border-slate-200 focus:bg-white resize-none transition-all"
          {...register(`skills.${index}.scope_include`, { required: true })}
        />
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Kriteria Anchor Level L1 s/d L5 (Standar B7)
        </Label>
        {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((key, i) => (
          <div key={key} className="space-y-1 p-2.5 rounded-xl border border-slate-100 bg-slate-50/30">
            <Label htmlFor={`skills.${index}.${key}`} className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-[#01959f]/10 text-[#01959f] flex items-center justify-center font-bold text-[10px]">
                L{i + 1}
              </span>
              <span>Kriteria Pembuktian Anchor L{i + 1} <span className="text-destructive">*</span></span>
            </Label>
            <Textarea
              id={`skills.${index}.${key}`}
              placeholder={LEVEL_PLACEHOLDERS[i + 1]}
              rows={2}
              className="rounded-xl p-2.5 text-xs sm:text-sm bg-white border-slate-200 focus:border-[#01959f] resize-none transition-all"
              {...register(`skills.${index}.${key}`, { required: true })}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-1 border-t border-slate-100">
        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Target Level Minimum yang Diharapkan
        </Label>
        <LevelRadio
          name={`custom-skill-${index}`}
          value={expectedLevel ?? 3}
          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
        />
      </div>
    </div>
  );
}
