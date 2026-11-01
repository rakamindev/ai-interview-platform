import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "@/components/LoadError";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/layout/PageHeader";
import { vacanciesApi } from "@/services/vacancies";
import { getApiErrorMessage } from "@/lib/apiError";
import { Plus, Briefcase, ChevronRight, Loader2 } from "lucide-react";
import type { PaginationMeta, Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadPage = useCallback((page: number) => {
    const firstPage = page === 1;
    if (firstPage) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    vacanciesApi
      .list(page)
      .then((res) => {
        setVacancies((prev) => (firstPage ? res.data.vacancies : [...prev, ...res.data.vacancies]));
        setMeta(res.data.meta);
      })
      .catch((requestError: unknown) =>
        setError(getApiErrorMessage(requestError, "Failed to load vacancies.")),
      )
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const nextPage = meta ? meta.current_page + 1 : 1;
  const hasMore = !!meta && meta.current_page < meta.total_pages;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Vacancies"
        description="Describe open roles so candidate portfolios can be compared against them."
        actions={
          <Button onClick={() => navigate("/vacancies/new")}>
            <Plus /> New Vacancy
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error && vacancies.length === 0 ? (
        <LoadError message={error} onRetry={() => loadPage(nextPage)} />
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No vacancies yet."
          description="Add a vacancy with the skill levels a role needs to run fit/gap reports."
          action={
            <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
              <Plus /> Create your first vacancy
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => (
            <Link
              key={v.id}
              to={`/vacancies/${v.id}/edit`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="flex items-center gap-4 p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 motion-reduce:transition-none">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rakamin-light-cyan text-primary">
                  <Briefcase className="h-5 w-5" />
                </span>
                <p className="min-w-0 flex-1 truncate font-medium">{v.role_title}</p>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Card>
            </Link>
          ))}
          {error && <LoadError message={error} onRetry={() => loadPage(nextPage)} />}
          {hasMore && !error && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => loadPage(nextPage)}
              disabled={loadingMore}
            >
              {loadingMore && <Loader2 className="animate-spin" />}
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
