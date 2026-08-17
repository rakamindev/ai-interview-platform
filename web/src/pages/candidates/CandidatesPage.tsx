import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Page, { PageHeader } from "@/components/layout/Page";
import { sessionsApi } from "@/services/sessions";
import { ArrowRight, Check, Eye, FileText, RefreshCw, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateRow } from "@/types";

type Filter = "all" | "active" | "needs_review" | "reviewed" | "no_report" | "failed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In progress" },
  { key: "needs_review", label: "Ready to review" },
  { key: "reviewed", label: "Reviewed" },
  { key: "no_report", label: "No report" },
  { key: "failed", label: "Interview errors" },
];

/**
 * Which bucket a candidate falls into.
 *
 * "Ready to review" is the one that matters: the interview finished, a report
 * exists, and nobody has signed off on it yet. That last clause is what makes
 * this a queue rather than a list — reviewed rows leave, so the count stays
 * worth reading. Without it, after fifty candidates "ready to review" means
 * nothing more than "everyone who finished".
 *
 * Order matters here. Reviewed wins over ready-to-review, and an interview
 * that broke is reported as broken whatever else is true of it.
 */
function bucket(row: CandidateRow): Filter {
  if (row.status === "active") return "active";
  if (row.status === "pending") return "all";
  if (row.end_reason === "error") return "failed";
  if (row.reviewed_at) return "reviewed";
  if (row.portfolio_status === "complete") return "needs_review";
  return "no_report";
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function StatusPill({ row }: { row: CandidateRow }) {
  const b = bucket(row);

  if (row.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-primary">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        In progress
      </span>
    );
  }
  if (row.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-attention">
        <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
        Not started
      </span>
    );
  }
  if (b === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Interview error
      </span>
    );
  }
  if (b === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
        Ready to review
      </span>
    );
  }
  if (b === "reviewed") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
        <Check className="h-3 w-3" aria-hidden />
        Reviewed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-border" />
      {row.portfolio_status === "generating" || row.portfolio_status === "pending"
        ? "Building report"
        : "No report"}
    </span>
  );
}

function RowAction({ row }: { row: CandidateRow }) {
  const base = `/assessments/${row.assessment_id}/sessions/${row.id}`;

  if (row.status === "active") {
    return (
      <Button asChild variant="outline" size="sm" className="h-8">
        <Link to={`${base}/monitor`}>
          <Eye className="mr-1 h-3.5 w-3.5" /> Monitor
        </Link>
      </Button>
    );
  }
  if (row.status === "pending") {
    return (
      <Button asChild variant="ghost" size="sm" className="h-8">
        <Link to={`/assessments/${row.assessment_id}/invite`}>
          Invite link <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }
  // A failed interview still has a transcript, and it is the session most
  // worth a human's attention.
  if (row.end_reason === "error") {
    return (
      <Button asChild variant="outline" size="sm" className="h-8">
        <Link to={`${base}/transcript`}>
          <FileText className="mr-1 h-3.5 w-3.5" /> Transcript
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className="h-8">
      <Link to={`${base}/portfolio`}>Results</Link>
    </Button>
  );
}

export default function CandidatesPage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    sessionsApi
      .listCandidates()
      .then((res) => setRows(res.data.sessions))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c = { active: 0, needs_review: 0, failed: 0 };
    for (const row of rows) {
      const b = bucket(row);
      if (b === "active") c.active += 1;
      if (b === "needs_review") c.needs_review += 1;
      if (b === "failed") c.failed += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => bucket(r) === filter)),
    [rows, filter],
  );

  return (
    <Page width="board" className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/assessments">
              Assessments <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        <h1 className="text-xl font-semibold">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who has been invited, across every assessment.
        </p>
      </PageHeader>

      {/* The count that changes what someone does next, stated in words. */}
      {!loading && !failed && rows.length > 0 && (
        <div
          className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
          data-testid="candidates-summary"
        >
          <span className={counts.needs_review > 0 ? "text-ok" : "text-muted-foreground"}>
            <span className="font-mono font-medium tabular-nums">{counts.needs_review}</span>{" "}
            ready to review
          </span>
          <span className={counts.active > 0 ? "text-primary" : "text-muted-foreground"}>
            <span className="font-mono font-medium tabular-nums">{counts.active}</span> in progress
          </span>
          {counts.failed > 0 && (
            <span className="text-attention">
              <span className="font-mono font-medium tabular-nums">{counts.failed}</span>{" "}
              {counts.failed === 1 ? "interview" : "interviews"} broke before finishing
            </span>
          )}
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {rows.length} total
          </span>
        </div>
      )}

      {!loading && !failed && rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-2" data-testid="candidates-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && failed && (
        <div className="rounded-lg border border-destructive/40 p-5" data-testid="candidates-failed">
          <p className="text-sm">
            The candidate list could not be loaded. This is not the same as having no candidates.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      )}

      {!loading && !failed && rows.length === 0 && (
        <div className="rounded-lg border p-12 text-center" data-testid="candidates-empty">
          <UserRound className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No candidates yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create an assessment, then invite someone to sit it. They will appear here as soon as
            the link is sent.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/assessments">Go to assessments</Link>
          </Button>
        </div>
      )}

      {!loading && !failed && rows.length > 0 && (
        /* Columns on a wide screen, stacked blocks on a phone. A fixed-width
           row inside a horizontal scroller would technically fit, but reading
           a queue by dragging it sideways is not reading it. */
        <div className="rounded-lg border">
          <div className="divide-y">
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No candidates in this state.
              </p>
            ) : (
              visible.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
                  data-testid="candidate-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.candidate_name || `Candidate ${row.id}`}
                    </p>
                    <Link
                      to={`/assessments/${row.assessment_id}/invite`}
                      className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {row.assessment?.name ?? "Unknown assessment"}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:contents">
                    <div className="sm:w-40 sm:shrink-0">
                      <StatusPill row={row} />
                    </div>

                    <div className="font-mono text-xs tabular-nums text-muted-foreground sm:w-24 sm:shrink-0 sm:text-right">
                      {relativeTime(row.ended_at ?? row.started_at ?? row.created_at)}
                    </div>

                    <div className="shrink-0 sm:w-32 sm:text-right">
                      <RowAction row={row} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
