import { useEffect, useState, useCallback } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, ChevronRight, Pencil } from "lucide-react";
import type { Vacancy, PaginationMeta } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const loadVacancies = useCallback(() => {
    setLoading(true);
    setError(false);
    vacanciesApi
      .list(currentPage)
      .then((res) => {
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [currentPage]);

  useEffect(() => {
    loadVacancies();
  }, [loadVacancies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vacancies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Job roles and target competency profiles linked to interview rubrics.
          </p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Failed to load vacancies"
          description="An error occurred while fetching vacancies. Please check your connection and try again."
          onRetry={loadVacancies}
        />
      )}

      {loading ? (
        <div className="border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Role Title</th>
                <th className="py-3 px-4 font-semibold">Competencies</th>
                <th className="py-3 px-4 font-semibold">Culture Expectations</th>
                <th className="py-3 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td className="py-3.5 px-4 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </td>
                  <td className="py-3.5 px-4">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="py-3.5 px-4">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Skeleton className="h-8 w-20 ml-auto rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Role Title</th>
                  <th className="py-3 px-4 font-semibold">Competencies</th>
                  <th className="py-3 px-4 font-semibold">Culture Expectations</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vacancies.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{v.role_title}</div>
                      <div className="text-xs text-muted-foreground">ID: #{v.id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {v.vacancy_skills && v.vacancy_skills.length > 0 ? (
                        <span>{v.vacancy_skills.length} skills specified</span>
                      ) : (
                        <span>General rubric</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-xs text-muted-foreground">
                      {v.culture_dimensions || "Standard alignment"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit vacancy"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vacancies/${v.id}/edit`);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <Pagination
          currentPage={meta.current_page}
          totalPages={meta.total_pages}
          onPageChange={(page) => setSearchParams({ page: String(page) })}
        />
      )}
    </div>
  );
}
