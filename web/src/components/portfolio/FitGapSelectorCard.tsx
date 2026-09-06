import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Vacancy } from "@/types";

interface FitGapSelectorCardProps {
  vacancies: Vacancy[];
  selectedVacancy: string;
  onSelectVacancy: (vacancyId: string) => void;
  onRunFitGap: () => void;
}

export default function FitGapSelectorCard({
  vacancies,
  selectedVacancy,
  onSelectVacancy,
  onRunFitGap,
}: FitGapSelectorCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-medium">Role Fit &amp; Gap Analysis</h3>
        <p className="text-xs text-muted-foreground">
          Compare this candidate's demonstrated skill levels against a specific vacancy requirement.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={selectedVacancy} onValueChange={onSelectVacancy}>
          <SelectTrigger className="w-56 bg-background">
            <SelectValue placeholder="Choose vacancy..." />
          </SelectTrigger>
          <SelectContent>
            {vacancies.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.role_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onRunFitGap} disabled={!selectedVacancy}>
          Run Fit/Gap Analysis
        </Button>
      </div>
    </div>
  );
}
