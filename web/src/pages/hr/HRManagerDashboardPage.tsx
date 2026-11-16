import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSearch,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { Assessment, Session, Vacancy } from "@/types";

type AssessmentActivity = Assessment & { sessions: Session[] };

type DashboardData = {
  assessments: AssessmentActivity[];
  vacancies: Vacancy[];
  sessions: Session[];
  totalAssessments: number;
  totalVacancies: number;
};

const emptyData: DashboardData = {
  assessments: [],
  vacancies: [],
  sessions: [],
  totalAssessments: 0,
  totalVacancies: 0,
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getCandidateName(session: Session) {
  return session.candidate_name?.trim() || `Candidate #${session.id}`;
}

function StatusPill({ status }: { status: Session["status"] }) {
  const styles: Record<Session["status"], string> = {
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    active: "bg-sky-50 text-sky-700 ring-sky-600/20",
    ended: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  };

  const labels: Record<Session["status"], string> = {
    pending: "Invited",
    active: "In progress",
    ended: "Completed",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Users;
  tone?: "teal" | "blue" | "amber" | "green";
}) {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <span className={`rounded-xl p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function HRManagerDashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [assessmentResponse, vacancyResponse] = await Promise.all([
        assessmentsApi.list(),
        vacanciesApi.list(),
      ]);

      const assessmentList = assessmentResponse.data.assessments ?? [];
      const sessionResults = await Promise.allSettled(
        assessmentList.map((assessment) => assessmentsApi.getSessions(assessment.id))
      );

      const assessments: AssessmentActivity[] = assessmentList.map((assessment, index) => ({
        ...assessment,
        sessions:
          sessionResults[index].status === "fulfilled"
            ? sessionResults[index].value.data.sessions ?? []
            : [],
      }));

      const sessions = assessments
        .flatMap((assessment) =>
          assessment.sessions.map((session) => ({
            ...session,
            assessment_id: session.assessment_id || assessment.id,
          }))
        )
        .sort((a, b) => {
          const aDate = new Date(a.created_at ?? 0).getTime();
          const bDate = new Date(b.created_at ?? 0).getTime();
          return bDate - aDate;
        });

      setData({
        assessments,
        vacancies: vacancyResponse.data.vacancies ?? [],
        sessions,
        totalAssessments: assessmentResponse.data.meta?.total_count ?? assessmentList.length,
        totalVacancies: vacancyResponse.data.meta?.total_count ?? vacancyResponse.data.vacancies?.length ?? 0,
      });

      if (sessionResults.some((result) => result.status === "rejected")) {
        setError("Some assessment activity could not be loaded. The figures may be incomplete.");
      }
    } catch {
      setError("We couldn't load the dashboard data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const invited = data.sessions.filter((session) => session.status === "pending").length;
    const inProgress = data.sessions.filter((session) => session.status === "active").length;
    const completed = data.sessions.filter((session) => session.status === "ended").length;

    return {
      candidates: data.sessions.length,
      invited,
      inProgress,
      completed,
    };
  }, [data.sessions]);

  const pipeline = [
    { label: "Invited", count: metrics.invited, color: "bg-amber-400" },
    { label: "In progress", count: metrics.inProgress, color: "bg-sky-500" },
    { label: "Completed", count: metrics.completed, color: "bg-emerald-500" },
  ];
  const maxPipeline = Math.max(...pipeline.map((item) => item.count), 1);
  const recentSessions = data.sessions.slice(0, 6);
  const busiestAssessments = [...data.assessments]
    .sort((a, b) => b.sessions.length - a.sessions.length)
    .slice(0, 5);

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            HR workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Recruitment overview</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Monitor assessment activity, candidate progress, and the workload across your hiring pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            <CalendarDays className="h-3.5 w-3.5" />
            All-time overview
          </span>
          <Button variant="outline" size="sm" onClick={() => void loadDashboard(true)} disabled={loading || refreshing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)
        ) : (
          <>
            <MetricCard label="Candidates" value={metrics.candidates} helper="Total interview sessions" icon={Users} tone="teal" />
            <MetricCard label="Invited" value={metrics.invited} helper="Waiting to start" icon={Clock3} tone="amber" />
            <MetricCard label="In progress" value={metrics.inProgress} helper="Live interview sessions" icon={Activity} tone="blue" />
            <MetricCard label="Completed" value={metrics.completed} helper="Interview sessions ended" icon={CheckCircle2} tone="green" />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Candidate pipeline</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Current distribution by interview status</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <>
                {pipeline.map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${item.color}`}
                        style={{ width: `${(item.count / maxPipeline) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {data.sessions.length === 0 && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    Pipeline activity will appear here once candidates are invited.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Workspace snapshot</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Your organization's assessment setup</p>
            </div>
            <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground">Assessments</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? "—" : data.totalAssessments}</p>
              <Link to="/assessments" className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline">
                View assessments <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-lg bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground">Vacancies</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? "—" : data.totalVacancies}</p>
              <Link to="/vacancies" className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline">
                View vacancies <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
            <div className="col-span-2 flex items-start gap-3 rounded-lg border p-3">
              <span className="rounded-lg bg-primary/10 p-2 text-primary"><ClipboardCheck className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-medium">Assessment-led hiring</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Review candidate portfolios and fit-gap reports before making a hiring decision. AI-generated insights should support—not replace—human review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Recent candidate activity</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Latest interview sessions across assessments</p>
            </div>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div>
            ) : recentSessions.length === 0 ? (
              <div className="py-9 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No candidate activity yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Candidate sessions will show up here when invitations are created.</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentSessions.map((session) => {
                  const assessment = data.assessments.find((item) => item.id === session.assessment_id);
                  return (
                    <div key={session.id} className="flex flex-col gap-2 py-3 first:pt-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{getCandidateName(session)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {assessment?.name ?? "Assessment"} · {formatDate(session.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <StatusPill status={session.status} />
                        {session.status === "ended" ? (
                          <Link
                            to={`/assessments/${session.assessment_id}/sessions/${session.id}/portfolio`}
                            className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                          >
                            Review <ArrowUpRight className="ml-1 h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="w-12" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Assessment activity</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Sessions grouped by assessment</p>
            </div>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div>
            ) : busiestAssessments.length === 0 ? (
              <div className="py-9 text-center">
                <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No assessments available</p>
                <p className="mt-1 text-xs text-muted-foreground">Create an assessment to start tracking activity.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {busiestAssessments.map((assessment) => {
                  const count = assessment.sessions.length;
                  const max = Math.max(...busiestAssessments.map((item) => item.sessions.length), 1);
                  return (
                    <div key={assessment.id}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{assessment.name}</p>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count} sessions</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Dashboard figures are calculated from the assessment and session records currently available to your account.</p>
        <Link to="/assessments" className="inline-flex items-center font-medium text-primary hover:underline">
          Browse assessments <ArrowUpRight className="ml-1 h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
