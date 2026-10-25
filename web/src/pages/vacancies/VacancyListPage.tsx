import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { Alert, AlertContent } from "@/components/ui/alert";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vacancy } from "@/types";

const ICON_COLORS = [
  { bg: "bg-teal-50", stroke: "text-teal-700" },
  { bg: "bg-blue-50", stroke: "text-blue-700" },
  { bg: "bg-purple-50", stroke: "text-purple-700" },
  { bg: "bg-amber-50", stroke: "text-amber-700" },
  { bg: "bg-red-50", stroke: "text-red-700" },
];

function getIconColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  const fetchVacancies = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    try {
      const res = await vacanciesApi.list(page, 20, controller.signal);
      setVacancies(res.data.vacancies);
      setTotalCount(res.data.meta.total_count);
      setTotalPages(res.data.meta.total_pages);
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED") return;
      setError(true);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vacancies</h1>
          {loading ? (
            <Skeleton className="h-5 w-20 mt-1" />
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount} vacancy{totalCount !== 1 ? "ies" : ""}
            </p>
          )}
        </div>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New vacancy
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertContent>Failed to load vacancies. Please refresh the page.</AlertContent>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6 text-muted-foreground" />}
          title="No vacancies yet"
          description="Create a vacancy to start assessing candidates against an open role."
          action={
            <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {vacancies.map((v) => {
            const { bg, stroke } = getIconColor(v.role_title);

            return (
              <div
                key={v.id}
                onClick={() => navigate(`/vacancies/${v.id}`)}
                className="flex items-center gap-3.5 bg-white border border-gray-200 rounded-xl px-4 py-3.5 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    bg
                  )}
                >
                  <Briefcase className={cn("w-5 h-5", stroke)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {v.role_title}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                    {v.skills_count ?? 0} skill{(v.skills_count ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && vacancies.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={cn(
                "h-8 w-8 rounded-md text-sm font-medium border transition-colors",
                p === page
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {p}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
