import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, ChevronLeft } from "lucide-react";
import type { Vacancy, PaginationMeta } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(false);
    vacanciesApi.list(page)
      .then((res) => {
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {vacancies.map((v) => (
              <Card
                key={v.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-sm">{v.role_title}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>

          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Page {meta.current_page} of {meta.total_pages} ({meta.total_count} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
