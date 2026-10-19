import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const loadVacancies = useCallback(() => {
    setLoading(true);
    setError(false);
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => loadVacancies(), [loadVacancies]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Vacancies</h1>
          <p className="text-sm text-muted-foreground">Define role expectations for candidate fit analysis.</p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4" /> New vacancy
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">Vacancies could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={loadVacancies}>Try again</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !error && vacancies.length === 0 ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <h2 className="font-medium">No vacancies yet</h2>
          <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-muted-foreground">Add a role and its expected skills to compare candidates against it.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4" /> Create vacancy
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => (
            <Link key={v.id} to={`/vacancies/${v.id}/edit`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="transition-colors group-hover:border-primary/40 group-focus-visible:border-primary">
                <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Briefcase className="h-4 w-4 shrink-0 text-primary" />
                    <p className="truncate font-medium">{v.role_title}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
