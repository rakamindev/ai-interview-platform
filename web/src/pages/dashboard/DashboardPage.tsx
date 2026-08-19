import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/services/dashboard";
import { useUser } from "@/hooks/useUser";
import {
  Radio,
  FileCheck2,
  ClipboardList,
  Briefcase,
  Plus,
  ArrowRight,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import type { DashboardStats } from "@/types";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { canEdit, isHiringManager } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await dashboardApi.getStats();
      setStats(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !stats) {
    return <LoadingState rows={4} />;
  }

  if (error && !stats) {
    return <ErrorState onRetry={fetchStats} title="Failed to load dashboard metrics" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description={
          isHiringManager
            ? "Candidate pipeline review and competency evaluation insights."
            : "Live interview monitoring, pending portfolio reviews, and assessment workflows."
        }
        actions={
          canEdit && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate("/assessments/new")}>
                <Plus className="h-4 w-4 mr-1.5" /> New Assessment
              </Button>
            </div>
          )
        }
      />

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-primary shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Live Now</p>
              <div className="text-2xl font-bold text-foreground">
                {stats?.live_count ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Needs Review */}
        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Needs Review</p>
              <div className="text-2xl font-bold text-foreground">
                {stats?.awaiting_review_count ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Assessments */}
        <Card className="border-l-4 border-l-teal-500 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Assessments</p>
              <div className="text-2xl font-bold text-foreground">
                {stats?.total_assessments ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <ClipboardList className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Vacancies */}
        <Card className="border-l-4 border-l-indigo-500 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Vacancies</p>
              <div className="text-2xl font-bold text-foreground">
                {stats?.total_vacancies ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Briefcase className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 2-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Live Now Sessions */}
        <Card className="shadow-xs flex flex-col">
          <CardHeader className="p-4 pb-3 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <CardTitle className="text-sm font-semibold">Live Interviews</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {stats?.live_sessions?.length || 0} active
            </span>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            {!stats?.live_sessions || stats.live_sessions.length === 0 ? (
              <div className="py-8 text-center space-y-2 text-muted-foreground">
                <Radio className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                <p className="text-xs font-medium">No candidates are currently interviewing.</p>
                <p className="text-[11px] text-muted-foreground">
                  Send invite links to candidates from your assessment details page.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.live_sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">
                        {sess.candidate_name || `Candidate #${sess.id}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {sess.assessment_name}
                      </div>
                      {sess.started_at && (
                        <div className="text-[10px] text-primary flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          Started: {new Date(sess.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      className="shrink-0 text-xs h-8 gap-1.5"
                      onClick={() =>
                        navigate(`/assessments/${sess.assessment_id}/sessions/${sess.id}/monitor`)
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Live Monitor</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Needs Review Sessions */}
        <Card className="shadow-xs flex flex-col">
          <CardHeader className="p-4 pb-3 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">Awaiting Review</CardTitle>
            </div>
            <Link
              to="/candidates?status=needs_review"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            {!stats?.awaiting_review_sessions || stats.awaiting_review_sessions.length === 0 ? (
              <div className="py-8 text-center space-y-2 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto opacity-40 text-primary" />
                <p className="text-xs font-medium">All completed sessions have been reviewed!</p>
                <p className="text-[11px] text-muted-foreground">
                  New finished interviews will appear here for grading and audit overrides.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.awaiting_review_sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">
                        {sess.candidate_name || `Candidate #${sess.id}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {sess.assessment_name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Finished: {sess.ended_at ? new Date(sess.ended_at).toLocaleDateString() : "Just now"}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs h-8"
                      onClick={() =>
                        navigate(`/assessments/${sess.assessment_id}/sessions/${sess.id}/portfolio`)
                      }
                    >
                      Review Portfolio
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions Overview */}
      <Card className="shadow-xs">
        <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Recent Candidate Sessions</CardTitle>
          <Link
            to="/candidates"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Cross-Assessment Candidates</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {!stats?.recent_sessions || stats.recent_sessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No recent interview sessions recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Assessment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.recent_sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {s.candidate_name || `Candidate #${s.id}`}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{s.assessment_name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            s.status === "active"
                              ? "bg-primary/10 text-primary"
                              : s.status === "ended"
                              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {s.status === "active" ? "Live Now" : s.status === "ended" ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (s.status === "active") {
                              navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/monitor`);
                            } else {
                              navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/portfolio`);
                            }
                          }}
                        >
                          Open &rarr;
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
