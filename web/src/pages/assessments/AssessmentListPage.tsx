import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

function SessionSummary({ summary }: { summary?: Assessment["session_summary"] }) {
  if (!summary?.total) return <span className="text-xs text-muted-foreground">No candidates invited yet</span>;

  const statuses = [
    summary.active > 0 && { label: `${summary.active} live`, className: "text-primary" },
    summary.pending > 0 && { label: `${summary.pending} awaiting`, className: "text-amber-800" },
    summary.completed > 0 && { label: `${summary.completed} completed`, className: "text-green-700" },
    summary.failed > 0 && { label: `${summary.failed} failed`, className: "font-medium text-destructive" },
  ].filter((status) => status !== false);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="font-medium text-foreground">{summary.total} {summary.total === 1 ? "candidate" : "candidates"}</span>
      {statuses.map((status) => status && (
        <span key={status.label} className="inline-flex items-center gap-x-3">
          <span aria-hidden="true" className="font-semibold text-muted-foreground">·</span>
          <span className={status.className}>{status.label}</span>
        </span>
      ))}
    </div>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
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
    assessmentsApi
      .list(page, debouncedSearch, controller.signal)
      .then((res) => {
        setAssessments(res.data.assessments);
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
      <div className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Assessments</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Create interview plans, invite candidates, and review their results.</p>
        </div>
        <Button className="h-12 w-full px-5 sm:w-auto" onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4" /> New assessment
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <label className="mb-2 block text-sm font-medium" htmlFor="assessment-search">Find an assessment</label>
        <div className="relative max-w-xl">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="assessment-search"
            autoComplete="off"
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by role title"
            type="search"
            value={search}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">Assessments could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" className="min-h-11" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </div>
      )}

      {error ? null : loading ? (
        <div aria-busy="true" className="space-y-3">
          <p role="status" className="sr-only">Loading assessments</p>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !error && assessments.length === 0 && !debouncedSearch ? (
        <div className="rounded-xl border bg-card px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">No assessments yet</h2>
          <p className="mx-auto mb-6 mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Create an interview plan with the role and skills you want to assess.</p>
          <Button className="h-12 px-5" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4" /> Create assessment
          </Button>
        </div>
      ) : !error && assessments.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">No matching assessments</h2>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">Try another role title or clear your search.</p>
          <Button variant="outline" className="min-h-11" onClick={clearSearch}>Clear search</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Link key={a.id} to={`/assessments/${a.id}/invite`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="shadow-none transition-colors group-hover:border-primary/50 group-focus-visible:border-primary">
                <CardContent className="flex min-h-24 items-center justify-between gap-4 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{a.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                        {a.time_limit_min} min
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{a.language === "id" ? "Bahasa Indonesia" : "English"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{a.skill_count ?? 0} skills</span>
                    </div>
                    {a.skill_preview && a.skill_preview.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {a.skill_preview.map((skill, index) => (
                          <span key={`${skill}-${index}`} className="max-w-48 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">
                            {skill}
                          </span>
                        ))}
                        {(a.skill_count ?? 0) > a.skill_preview.length && (
                          <span className="self-center text-xs text-muted-foreground">+{(a.skill_count ?? 0) - a.skill_preview.length} more</span>
                        )}
                      </div>
                    )}
                    <div className="mt-2">
                      <SessionSummary summary={a.session_summary} />
                    </div>
                  </div>
                  <span className="hidden shrink-0 items-center gap-2 text-sm font-medium text-primary sm:flex">
                    Manage assessment
                    <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {meta && meta.total_count > 0 && (
            <nav aria-label="Assessment pages" className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(meta.current_page - 1) * meta.per_page + 1}-{Math.min(meta.current_page * meta.per_page, meta.total_count)} of {meta.total_count} assessments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  className="min-h-11"
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
                  className="min-h-11"
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
