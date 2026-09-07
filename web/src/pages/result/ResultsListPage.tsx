import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resultsApi, type ResultRow } from "@/services/results";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  PauseCircle,
  Pencil,
  Search,
  XCircle,
} from "lucide-react";

const DECISION_LOOK = {
  advance: { label: "Advance", icon: CheckCircle2, tone: "text-emerald-700" },
  hold: { label: "Hold", icon: PauseCircle, tone: "text-amber-700" },
  reject: { label: "Reject", icon: XCircle, tone: "text-rose-700" },
} as const;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "undecided", label: "Undecided" },
  { key: "advance", label: "Advance" },
  { key: "hold", label: "Hold" },
  { key: "reject", label: "Reject" },
] as const;

/**
 * Every finished candidate, across every role.
 *
 * A result could previously only be reached by remembering which assessment it
 * belonged to and opening that first. That works for the person who ran the
 * interview. It does not work for someone holding ten candidates across three
 * roles who needs to know which of them are still waiting on them.
 */
export default function ResultsListPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [undecided, setUndecided] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    resultsApi
      .list({ decision: filter, needsAttention: onlyAttention })
      .then((res) => {
        setRows(res.data.results);
        setUndecided(res.data.meta.undecided);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [filter, onlyAttention]);

  // Searching is local: the list is already scoped to one tenant and a round
  // trip per keystroke would buy nothing.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.candidate_name ?? "").toLowerCase().includes(needle) ||
        r.assessment_name.toLowerCase().includes(needle)
    );
  }, [rows, query]);

  const attentionCount = rows.filter((r) => r.needs_attention).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Results</h1>
        {!loading && !error && (
          <p className="text-sm text-muted-foreground">
            {/* The number this page exists to surface. */}
            {undecided > 0
              ? `${undecided} finished interview${undecided === 1 ? "" : "s"} nobody has decided on yet`
              : "Every finished interview has a decision"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-neutral-200 text-muted-foreground hover:border-neutral-300"
            )}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOnlyAttention((v) => !v)}
          aria-pressed={onlyAttention}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            onlyAttention
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-neutral-200 text-muted-foreground hover:border-neutral-300"
          )}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Needs attention{!onlyAttention && attentionCount > 0 ? ` (${attentionCount})` : ""}
        </button>

        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Candidate or role..."
            aria-label="Search results"
            className="h-8 pl-9 text-xs"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Failed to load results. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No finished interviews yet. Results appear here once a session ends and its portfolio is generated."
            : "Nothing matches these filters."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const look = r.decision ? DECISION_LOOK[r.decision] : null;
            const Icon = look?.icon;

            return (
              <Card
                key={r.session_id}
                className={cn(
                  "cursor-pointer transition-colors hover:border-primary/40",
                  r.needs_attention && "border-amber-200"
                )}
                onClick={() => navigate(`/assessments/${r.assessment_id}/sessions/${r.session_id}/result`)}
              >
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      {r.candidate_name || "Unnamed candidate"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="break-words">{r.assessment_name}</span>

                      {r.duration_seconds != null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {Math.round(r.duration_seconds / 60)} min
                          </span>
                        </>
                      )}

                      {r.override_count > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            {r.override_count} corrected by hand
                          </span>
                        </>
                      )}
                    </div>

                    {/* Only rows that need something say more than their status. */}
                    {r.portfolio_status === "failed" ? (
                      <p className="mt-1 text-xs font-medium text-destructive">
                        The rating could not be generated. Needs a retry.
                      </p>
                    ) : (
                      (r.unassessed_count > 0 || r.low_confidence_count > 0) && (
                        <p className="mt-1 text-xs text-amber-700">
                          {r.unassessed_count > 0 && `${r.unassessed_count} skill${r.unassessed_count === 1 ? "" : "s"} never reached`}
                          {r.unassessed_count > 0 && r.low_confidence_count > 0 && ", "}
                          {r.low_confidence_count > 0 && `${r.low_confidence_count} rated on thin evidence`}
                        </p>
                      )
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {look && Icon ? (
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", look.tone)}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {look.label}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">Awaiting decision</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
