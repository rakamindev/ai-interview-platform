import { useId, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import LevelRadio from "@/components/assessment/LevelRadio";
import type { VacancySkill } from "@/types";
import { LEVEL_DESCRIPTIONS } from "@/utils/constants";

interface VacancySkillItemProps {
  skill: Partial<VacancySkill>;
  onLevelChange: (level: number) => void;
  onRemove: () => void;
}

export default function VacancySkillItem({ skill, onLevelChange, onRemove }: VacancySkillItemProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const label = skill.skill_label ?? "Skill";
  const anchors = [skill.l1_anchor, skill.l2_anchor, skill.l3_anchor, skill.l4_anchor, skill.l5_anchor];

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {anchors.some(Boolean) && (
        <div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {detailsOpen ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
            {detailsOpen ? "Hide level descriptions" : "Show L1-L5 descriptions"}
          </button>
          <dl id={detailsId} hidden={!detailsOpen} className="mt-2 space-y-3 rounded-md bg-muted/50 p-3 text-sm">
              {anchors.map((description, index) => description && (
                <div key={index} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3">
                  <dt className="font-medium text-foreground">L{index + 1} <span className="font-normal text-muted-foreground">{LEVEL_DESCRIPTIONS[index + 1]}</span></dt>
                  <dd className="min-w-0 text-muted-foreground">{description}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      <div className="space-y-1.5">
        <span className="text-sm text-muted-foreground">Expected level</span>
        <LevelRadio value={skill.expected_level ?? 3} onChange={onLevelChange} />
      </div>
    </div>
  );
}
