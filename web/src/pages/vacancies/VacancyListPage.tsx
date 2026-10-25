import { useEffect, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { vacanciesApi } from "@/services/vacancies";
import { vacancyKeys } from "@/lib/queryKeys";
import { Plus, Briefcase, ChevronRight } from "lucide-react";

function normalizedPage(value: string | null) {
  if (value === null) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function formatUpdatedDate(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function VacancyListPage() {
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
    queryKey: vacancyKeys.list(page),
    queryFn: async () => (await vacanciesApi.list({ page })).data,
    placeholderData: keepPreviousData,
  });
  const vacancies = data?.vacancies ?? [];
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
  const hasVacancies = vacancies.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {isError ? (
        <Alert>
          <p className="text-sm">Failed to load vacancies.</p>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => void refetch()}>
            Try Again
          </Button>
        </Alert>
      ) : initialLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !hasVacancies ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <div
          ref={resultsRef}
          className="space-y-4 outline-none"
          tabIndex={-1}
          aria-label={`Vacancy results, page ${meta?.current_page ?? page}`}
        >
          <div className="space-y-2" aria-busy={isFetching}>
            {vacancies.map((v) => {
              const updatedDate = formatUpdatedDate(v.updated_at);

              return (
                <Link
                  key={v.id}
                  to={`/vacancies/${v.id}/edit`}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Briefcase
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" title={v.role_title}>
                            {v.role_title}
                          </p>
                          {updatedDate && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Updated <time dateTime={v.updated_at}>{updatedDate}</time>
                            </p>
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
              );
            })}
          </div>

          {meta && (
            <Pagination
              currentPage={meta.current_page}
              totalPages={meta.total_pages}
              totalCount={meta.total_count}
              pageSize={meta.per_page}
              onPageChange={changePage}
              loading={isFetching}
              ariaLabel="Vacancy list pagination"
            />
          )}
        </div>
      )}
    </div>
  );
}
