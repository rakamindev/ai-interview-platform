import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { assessmentsApi } from "@/services/assessments";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle2,
  CircleDot,
  AlertCircle,
  Hourglass,
  BarChart2,
  Eye,
  FileText,
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

type SummarySession = {
  id: number;
  candidate_name?: string;
  status: "pending" | "active" | "ended";
  end_reason?: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  created_at?: string;
  portfolio_status?: string;
  portfolio_id?: number;
};

type SummaryStats = {
  total: number;
  pending: number;
  active: number;
  ended: number;
  completed: number;
  failed: number;
  avg_duration_min?: number;
};

type AssessmentInfo = {
  id: number;
  name: string;
  time_limit_min: number;
  language?: string;
};

type SortKey = "name" | "status" | "duration" | "date";
type SortDir = "asc" | "desc";

function StatusBadge({ session }: { session: SummarySession }) {
  if (session.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <Hourglass className="h-3 w-3" />
        Awaiting
      </span>
    );
  }
  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
        <CircleDot className="h-3 w-3 animate-pulse" />
        Live
      </span>
    );
  }
  if (session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Completed
    </span>
  );
}

export default function AssessmentSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentInfo | null>(null);
  const [sessions, setSessions] = useState<SummarySession[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  usePageTitle(assessment ? `Summary · ${assessment.name}` : "Summary");

  useEffect(() => {
    assessmentsApi
      .getSummary(Number(id))
      .then((res) => {
        setAssessment(res.data.assessment);
        setSessions(res.data.sessions);
        setStats(res.data.stats);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") {
      const aName = a.candidate_name ?? `#${a.id}`;
      const bName = b.candidate_name ?? `#${b.id}`;
      cmp = aName.localeCompare(bName);
    } else if (sortKey === "status") {
      const order = { active: 0, pending: 1, ended: 2 };
      cmp = (order[a.status] ?? 3) - (order[b.status] ?? 3);
    } else if (sortKey === "duration") {
      cmp = (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0);
    } else {
      cmp = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="border border-destructive/40 rounded-lg p-6 text-center text-sm text-destructive">
          Failed to load assessment summary.{" "}
          <Button variant="link" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const SortableHeader = ({ label, sortK }: { label: string; sortK: SortKey }) => (
    <button
      onClick={() => handleSort(sortK)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors",
        sortKey === sortK ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      {sortKey === sortK && (
        <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>
      )}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Assessments", href: "/assessments" },
          { label: assessment?.name ?? "Assessment", href: `/assessments/${id}/invite` },
          { label: "Summary" },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{assessment?.name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              <span>{assessment?.time_limit_min} min limit</span>
              {assessment?.language && (
                <>
                  <span>·</span>
                  <span className="uppercase">{assessment.language}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/invite`)}>
          <Users className="h-3.5 w-3.5 mr-1.5" />
          Candidates
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">candidates</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.completed}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0}
                % completion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <CircleDot className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{stats.pending} awaiting</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Avg Duration</span>
              </div>
              <p className="text-2xl font-bold">
                {stats.avg_duration_min != null ? `${stats.avg_duration_min}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">minutes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Candidate Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedSessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No candidates yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5">
                      <SortableHeader label="Candidate" sortK="name" />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortableHeader label="Status" sortK="status" />
                    </th>
                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">
                      <SortableHeader label="Duration" sortK="duration" />
                    </th>
                    <th className="text-left px-4 py-2.5 hidden md:table-cell">
                      <SortableHeader label="Date" sortK="date" />
                    </th>
                    <th className="text-right px-4 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedSessions.map((session) => {
                    const name = session.candidate_name || `Candidate #${session.id}`;
                    const isCompleted =
                      session.status === "ended" && session.end_reason !== "error";
                    const isLive = session.status === "active";
                    const durationMin = session.duration_seconds
                      ? Math.round(session.duration_seconds / 60)
                      : null;
                    const dateStr = session.started_at ?? session.created_at;

                    return (
                      <tr key={session.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm truncate max-w-[180px]">{name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge session={session} />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                          {durationMin != null ? `${durationMin} min` : "—"}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                          {dateStr ? new Date(dateStr).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {isLive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  navigate(
                                    `/assessments/${id}/sessions/${session.id}/monitor`
                                  )
                                }
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Monitor
                              </Button>
                            )}
                            {isCompleted && session.portfolio_status === "complete" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  navigate(
                                    `/assessments/${id}/sessions/${session.id}/portfolio`
                                  )
                                }
                              >
                                Results
                              </Button>
                            )}
                            {isCompleted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  navigate(
                                    `/assessments/${id}/sessions/${session.id}/transcript`
                                  )
                                }
                              >
                                <FileText className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

