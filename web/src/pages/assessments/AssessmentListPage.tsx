import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "@/components/LoadError";
import EmptyState from "@/components/EmptyState";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { assessmentsApi } from "@/services/assessments";
import { getApiErrorMessage } from "@/lib/apiError";
import { Plus, Clock, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
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
    assessmentsApi
      .list(page)
      .then((res) => {
        setAssessments((prev) =>
          firstPage ? res.data.assessments : [...prev, ...res.data.assessments],
        );
        setMeta(res.data.meta);
      })
      .catch((requestError: unknown) =>
        setError(getApiErrorMessage(requestError, "Failed to load assessments.")),
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
        title="Assessments"
        description="Configure skill interviews, invite candidates, and review their results."
        actions={
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus /> New Assessment
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error && assessments.length === 0 ? (
        <LoadError message={error} onRetry={() => loadPage(nextPage)} />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet."
          description="Create an assessment to choose the skills you want to evaluate and get an interview link."
          action={
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus /> Create your first assessment
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Link
              key={a.id}
              to={`/assessments/${a.id}/invite`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="flex items-center gap-4 p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 motion-reduce:transition-none">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rakamin-light-cyan text-primary">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {a.time_limit_min} min
                    </span>
                    {a.latest_session && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Latest session</span>
                        <SessionStatusBadge session={a.latest_session} />
                      </>
                    )}
                  </div>
                </div>
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
