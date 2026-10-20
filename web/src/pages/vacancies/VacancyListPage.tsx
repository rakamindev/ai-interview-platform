import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search } from "lucide-react";
import type { PaginationMeta, Vacancy, VacancyStatus } from "@/types";

const statusLabels: Record<VacancyStatus, string> = {
  active: "Active",
  closed: "Closed",
};

const statusStyles: Record<VacancyStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-800",
  closed: "border-red-200 bg-red-50 text-red-800",
};

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VacancyStatus | "all">("all");
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
    vacanciesApi.list({
      page,
      search: debouncedSearch,
      status: statusFilter === "all" ? undefined : statusFilter,
      signal: controller.signal,
    })
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
  }, [page, debouncedSearch, statusFilter, retry]);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Vacancies</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Define role expectations for candidate fit analysis.</p>
        </div>
        <Button className="h-12 w-full px-5 sm:w-auto" onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4" /> New vacancy
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <div className="relative min-w-0 flex-1">
          <label className="mb-2 block text-sm font-medium" htmlFor="vacancy-search">Search roles</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-[3.125rem] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="vacancy-search"
            autoComplete="off"
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search vacancies"
            type="search"
            value={search}
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="mb-2 block text-sm font-medium" htmlFor="vacancy-status-filter">Status</label>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as VacancyStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger id="vacancy-status-filter" className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">Vacancies could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </div>
      )}

      {error ? null : loading ? (
        <div aria-busy="true" className="space-y-3">
          <p role="status" className="sr-only">Loading vacancies</p>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : !error && vacancies.length === 0 && !debouncedSearch && statusFilter === "all" ? (
        <div className="rounded-xl border bg-card px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">No vacancies yet</h2>
          <p className="mx-auto mb-6 mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Add a role and its expected skills to compare candidates against it.</p>
          <Button className="h-12 px-5" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4" /> Create vacancy
          </Button>
        </div>
      ) : !error && vacancies.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">No matching vacancies</h2>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">Try another role title or status.</p>
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => (
            <Link key={v.id} to={`/vacancies/${v.id}/edit`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="shadow-none transition-colors group-hover:border-primary/50 group-focus-visible:border-primary">
                <CardContent className="flex min-h-24 items-center justify-between gap-4 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="min-w-0 break-words text-base font-semibold">{v.role_title || "Untitled vacancy"}</p>
                      <Badge variant="outline" className={statusStyles[v.status]}>{statusLabels[v.status]}</Badge>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Briefcase aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {v.skill_count} expected {v.skill_count === 1 ? "skill" : "skills"}
                    </p>
                    {v.skill_preview.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {v.skill_preview.map((skill, index) => (
                          <span key={`${skill}-${index}`} className="max-w-48 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">
                            {skill}
                          </span>
                        ))}
                        {v.skill_count > v.skill_preview.length && (
                          <span className="self-center text-xs text-muted-foreground">+{v.skill_count - v.skill_preview.length} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="hidden shrink-0 items-center gap-2 text-sm font-medium text-primary sm:flex">
                    Edit role
                    <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
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
