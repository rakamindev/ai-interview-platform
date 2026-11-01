import { X } from "lucide-react";
import LevelRadio from "@/components/assessment/LevelRadio";

interface VacancySkillRowProps {
  label: string;
  level: number;
  onLevelChange: (level: number) => void;
  onRemove: () => void;
}

export default function VacancySkillRow({
  label,
  level,
  onLevelChange,
  onRemove,
}: VacancySkillRowProps) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove skill"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Expected level</span>
        <LevelRadio value={level} onChange={onLevelChange} />
      </div>
    </div>
  );
}
