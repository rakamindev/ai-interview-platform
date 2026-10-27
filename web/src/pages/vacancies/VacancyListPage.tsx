import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase } from "lucide-react";
import type { Vacancy } from "@/types";
import { CardUi } from "@/components/cardUi/component";
import { EmptyStateVacancy } from "@/components/emptyState/component";
import { LoadingStateVacancy } from "@/components/loaderState/component";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-wide">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <div className="p-4 text-sm border rounded-lg border-destructive/40 text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading && <LoadingStateVacancy />}

      <div className="space-y-4">
        {/* Header daftar lowongan */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              List of Job Openings
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage and update your job postings.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" />
            {vacancies.length} job openings
          </div>
        </div>

        {/* Vacancy cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vacancies.map((v) => (
            <CardUi
              key={v.id}
              id={v.id}
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              Icon={Briefcase}
            >
              <div className="mt-4 space-y-2">
                <h3 className="text-base font-semibold leading-6 tracking-tight transition-colors line-clamp-2 min-h-12 group-hover:text-primary">
                  {v.role_title}
                </h3>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Manage detail job opening</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 mt-4 border-t border-border/70">
                <span className="text-xs font-medium transition-opacity text-primary group-hover:opacity-100">
                  Edit job opening
                </span>
              </div>
            </CardUi>
          ))}
        </div>

        {/* Empty state */}
        {vacancies.length === 0 && <EmptyStateVacancy />}
      </div>
    </div>
  );
}
