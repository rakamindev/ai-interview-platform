import { forwardRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Vacancy } from "@/types";

interface FitGapPickerProps {
  basePath: string;
  vacancies: Vacancy[];
}

// Picks a vacancy and opens the fit/gap report for it (anchor #fit-gap).
const FitGapPicker = forwardRef<HTMLButtonElement, FitGapPickerProps>(function FitGapPicker({ basePath, vacancies }, triggerRef) {
  const navigate = useNavigate();
  const [vacancyId, setVacancyId] = useState("");

  return (
    <section id="fit-gap" aria-labelledby="fit-gap-heading" className="space-y-3 rounded-lg border bg-card p-4">
      <h2 id="fit-gap-heading" className="text-base font-semibold">Fit/gap report</h2>
      {vacancies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No vacancy yet. <Link to="/vacancies/new" className="font-medium text-teal-800 underline-offset-4 hover:underline">Create a vacancy</Link> to compare this candidate.
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={vacancyId} onValueChange={setVacancyId}>
            <SelectTrigger ref={triggerRef} aria-label="Vacancy" className="w-full sm:w-72">
              <SelectValue placeholder="Choose a vacancy" />
            </SelectTrigger>
            <SelectContent>
              {vacancies.map((vacancy) => (
                <SelectItem key={vacancy.id} value={String(vacancy.id)}>{vacancy.role_title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" disabled={!vacancyId} onClick={() => navigate(`${basePath}/fitgap/${vacancyId}`)}>
            Open fit/gap report
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  );
});

export default FitGapPicker;
