import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import LevelRadio from "@/components/assessment/LevelRadio";
import type { VacancySkill } from "@/types";

export interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

interface VacancySkillCardProps {
  index: number;
  form: UseFormReturn<VacancyFormValues>;
  onRemove: () => void;
}

export default function VacancySkillCard({ index, form, onRemove }: VacancySkillCardProps) {
  const [collapsed, setCollapsed] = useState(true);
  const skill = useWatch({ control: form.control, name: `skills.${index}` });
  const label = skill?.skill_label || "New skill";

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex cursor-pointer items-center gap-2 p-3 hover:bg-muted/30" role="button" tabIndex={0} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`} onClick={() => setCollapsed((current) => !current)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setCollapsed((current) => !current); } }}>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`} onClick={(event) => { event.stopPropagation(); setCollapsed((current) => !current); }}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        <button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${label}`} onClick={(event) => { event.stopPropagation(); onRemove(); }}><X className="h-4 w-4" /></button>
      </div>
      {!collapsed && <div className="border-t px-3 pb-3 pt-3"><div className="space-y-1"><span className="text-xs text-muted-foreground">Required proficiency</span><LevelRadio value={skill?.expected_level ?? 3} onChange={(value) => form.setValue(`skills.${index}.expected_level`, value, { shouldDirty: true, shouldValidate: true })} /></div></div>}
    </div>
  );
}
