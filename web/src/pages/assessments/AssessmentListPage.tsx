import { useEffect, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { assessmentsApi } from "@/services/assessments";
import { assessmentKeys } from "@/lib/queryKeys";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";

function normalizedPage(value: string | null) {
  if (value === null) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
          aria-hidden="true"
        />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Last: failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Last: completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = searchParams.get("page");
  const page = normalizedPage(rawPage);
  const focusPageRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    data,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: assessmentKeys.list(page),
    queryFn: async () => (await assessmentsApi.list({ page })).data,
    placeholderData: keepPreviousData,
  });
  const assessments = data?.assessments ?? [];
  const meta = data?.meta ?? null;

  useEffect(() => {
    if (rawPage !== null && rawPage !== String(page)) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("page", String(page));
        return next;
      }, { replace: true });
    }
  }, [page, rawPage, setSearchParams]);

  useEffect(() => {
    if (!meta || isFetching) return;

    const lastPage = Math.max(meta.total_pages, 1);
    if (page > lastPage) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("page", String(lastPage));
        return next;
      }, { replace: true });
      return;
    }

    if (focusPageRef.current === page) {
      focusPageRef.current = null;
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ block: "start" });
        resultsRef.current?.focus({ preventScroll: true });
      });
    }
  }, [isFetching, meta, page, setSearchParams]);

  const changePage = (nextPage: number) => {
    focusPageRef.current = nextPage;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("page", String(nextPage));
      return next;
    });
  };

  const initialLoading = isPending;
  const hasAssessments = assessments.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {isError ? (
        <Alert>
          <p className="text-sm">Failed to load assessments.</p>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => void refetch()}>
            Try Again
          </Button>
        </Alert>
      ) : initialLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !hasAssessments ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <div
          ref={resultsRef}
          className="space-y-4 outline-none"
          tabIndex={-1}
          aria-label={`Assessment results, page ${meta?.current_page ?? page}`}
        >
          <div className="space-y-2" aria-busy={isFetching}>
            {assessments.map((a) => (
              <Link
                key={a.id}
                to={`/assessments/${a.id}/invite`}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={a.name}>
                        {a.name}
                      </p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex shrink-0 items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {a.time_limit_min} min
                        </span>
                        {a.latest_session && (
                          <>
                            <span aria-hidden="true">·</span>
                            <SessionSummary session={a.latest_session} />
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {meta && (
            <Pagination
              currentPage={meta.current_page}
              totalPages={meta.total_pages}
              totalCount={meta.total_count}
              pageSize={meta.per_page}
              onPageChange={changePage}
              loading={isFetching}
              ariaLabel="Assessment list pagination"
            />
          )}
        </div>
      )}
    </div>
  );
}
