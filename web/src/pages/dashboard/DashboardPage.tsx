import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi } from "@/services/dashboard";
import { END_REASON_LABELS } from "@/utils/constants";
import { formatRate, formatDuration } from "@/utils/format";
import { UserRound, Activity, Hourglass, CheckCircle2, XCircle, Percent, Timer } from "lucide-react";
import type { DashboardStats } from "@/types";

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 px-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const res = await dashboardApi.stats();
    setStats(res.data);
  }, []);

  useEffect(() => {
    load().catch(() => setError(true)).finally(() => setLoading(false));
  }, [load]);

  // Poll live status
  useEffect(() => {
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full mt-2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 text-center border rounded-lg text-sm text-destructive">
        Failed to load dashboard. Please refresh the page.
      </div>
    );
  }

  const totals = stats.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Live overview of your interview pipeline.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={UserRound} label="Total candidates" value={stats.total}
          accent="bg-primary/10 text-primary" />
        <StatCard icon={Activity} label="Live now" value={totals.active}
          accent="bg-green-500/10 text-green-600" />
        <StatCard icon={Hourglass} label="Awaiting candidate" value={totals.pending}
          accent="bg-amber-500/10 text-amber-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={totals.ended}
          accent="bg-blue-500/10 text-blue-600" />
        <StatCard icon={XCircle} label="Failed" value={totals.failed}
          accent="bg-destructive/10 text-destructive" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Percent} label="Completion rate" value={formatRate(stats.completion_rate)}
          accent="bg-teal-500/10 text-teal-600" />
        <StatCard icon={Timer} label="Avg duration" value={formatDuration(stats.avg_duration_seconds)}
          accent="bg-purple-500/10 text-purple-600" />
        <Card>
          <CardContent className="py-4 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Ended reasons</p>
            {stats.ended_reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ended sessions yet.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.ended_reasons
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map(({ reason, count }) => (
                    <div key={reason} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {END_REASON_LABELS[reason] ?? reason}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.live_sessions.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-3">Currently interviewing</h2>
            <div className="divide-y">
              {stats.live_sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {s.candidate_name || `Candidate #${s.id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.assessment_name} · started{" "}
                      {s.started_at
                        ? new Date(s.started_at).toLocaleTimeString()
                        : "—"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Per assessment</h2>
        {stats.per_assessment.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No assessments yet. Create one to start inviting candidates.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Assessment</th>
                  <th className="text-right font-medium px-4 py-2">Total</th>
                  <th className="text-right font-medium px-4 py-2">Started</th>
                  <th className="text-right font-medium px-4 py-2">Rate</th>
                  <th className="text-right font-medium px-4 py-2 text-green-600">Live</th>
                  <th className="text-right font-medium px-4 py-2 text-amber-600">Pending</th>
                  <th className="text-right font-medium px-4 py-2 text-blue-600">Completed</th>
                  <th className="text-right font-medium px-4 py-2 text-destructive">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.per_assessment.map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/assessments/${a.id}/invite`)}
                  >
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2 text-right">{a.total}</td>
                    <td className="px-4 py-2 text-right">{a.started}</td>
                    <td className="px-4 py-2 text-right">{formatRate(a.completion_rate)}</td>
                    <td className="px-4 py-2 text-right">{a.totals.active}</td>
                    <td className="px-4 py-2 text-right">{a.totals.pending}</td>
                    <td className="px-4 py-2 text-right">{a.totals.ended}</td>
                    <td className="px-4 py-2 text-right">{a.totals.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}