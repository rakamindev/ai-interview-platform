import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search } from "lucide-react";
import type { PaginationMeta, Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    vacanciesApi.list(page, debouncedSearch, controller.signal)
      .then((res) => {
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, debouncedSearch, retry]);

  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

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

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search vacancies by role title"
          autoComplete="off"
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search vacancies"
          type="search"
          value={search}
        />
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">Vacancies could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </div>
      )}

      {error ? null : loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !error && vacancies.length === 0 && !debouncedSearch ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <h2 className="font-medium">No vacancies yet</h2>
          <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-muted-foreground">Add a role and its expected skills to compare candidates against it.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4" /> Create vacancy
          </Button>
        </div>
      ) : !error && vacancies.length === 0 ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <h2 className="font-medium">No matching vacancies</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Try another role title or clear your search.</p>
          <Button variant="outline" onClick={clearSearch}>Clear search</Button>
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
          {meta && meta.total_count > 0 && (
            <nav aria-label="Vacancy pages" className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(meta.current_page - 1) * meta.per_page + 1}-{Math.min(meta.current_page * meta.per_page, meta.total_count)} of {meta.total_count} vacancies
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={meta.current_page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                  variant="outline"
                >
                  Previous
                </Button>
                <span aria-live="polite" className="min-w-24 text-center text-sm text-muted-foreground">
                  Page {meta.current_page} of {meta.total_pages}
                </span>
                <Button
                  disabled={meta.current_page >= meta.total_pages || loading}
                  onClick={() => setPage((current) => current + 1)}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
