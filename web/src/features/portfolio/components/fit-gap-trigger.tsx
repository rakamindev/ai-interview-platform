import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import { vacancyQueries } from "@/features/vacancy/queries/vacancy";

interface Option {
  value: string;
  label: string;
}

interface FitGapTriggerProps {
  assessmentId: string;
  sessionId: string;
}

export function FitGapTrigger({ assessmentId, sessionId }: FitGapTriggerProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<Option | null>(null);

  const { data, isLoading } = useQuery(vacancyQueries.list({ page: 1, per_page: 100 }));
  const vacancies = data?.vacancies ?? [];
  const vacancyItems = vacancies.map((v) => ({ value: String(v.id), label: v.role_title }));

  const handleRun = () => {
    if (!selectedVacancy) return;
    navigate({
      to: "/assessments/$assessmentId/sessions/$sessionId/fitgap/$vacancyId",
      params: { assessmentId, sessionId, vacancyId: selectedVacancy.value },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        Fit/Gap Analysis
      </PopoverTrigger>

      <PopoverContent className="w-72 p-2.5 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fit/Gap Analysis
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vacancy_id" className="text-sm">Choose vacancy:</Label>
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Combobox
              id="vacancy_id"
              items={vacancyItems}
              value={selectedVacancy}
              onValueChange={setSelectedVacancy}
            >
              <ComboboxInput placeholder="Search vacancies..." showClear />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No vacancy found.</ComboboxEmpty>
                  {vacancyItems.map((item) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          )}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleRun} disabled={!selectedVacancy}>
            Run Analysis
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
