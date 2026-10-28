import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import LevelRadio from "@/components/assessment/LevelRadio";

interface VacancySkillRowProps {
  label: string;
  level: number;
  onLevelChange: (level: number) => void;
  onRemove: () => void;
}

// One required skill of a vacancy form: its name, expected level and a named
// remove button.
export default function VacancySkillRow({ label, level, onLevelChange, onRemove }: VacancySkillRowProps) {
  return (
    <li className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium [overflow-wrap:anywhere]">{label}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={onRemove} aria-label={`Remove ${label}`}>
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        <span aria-hidden="true" className="text-xs text-muted-foreground">Expected level</span>
        <LevelRadio label={`Expected level for ${label}`} value={level} onChange={onLevelChange} className="flex-wrap" />
      </div>
    </li>
  );
}
