import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="text-xs text-muted-foreground">No candidate invited yet</span>;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground">Create interview plans and invite candidates.</p>
        </div>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4" /> New assessment
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search assessments by name"
          autoComplete="off"
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assessments"
          type="search"
          value={search}
        />
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">Assessments could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </div>
      )}

      {error ? null : loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !error && assessments.length === 0 && !debouncedSearch ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <h2 className="font-medium">No assessments yet</h2>
          <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-muted-foreground">Create an interview plan with the role and skills you want to assess.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4" /> Create assessment
          </Button>
        </div>
      ) : !error && assessments.length === 0 ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <h2 className="font-medium">No matching assessments</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Try another name or clear your search.</p>
          <Button variant="outline" onClick={clearSearch}>Clear search</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Link key={a.id} to={`/assessments/${a.id}/invite`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="transition-colors group-hover:border-primary/40 group-focus-visible:border-primary">
                <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.time_limit_min} min
                      </span>
                      <span aria-hidden="true">·</span>
                      <SessionSummary session={a.latest_session} />
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
