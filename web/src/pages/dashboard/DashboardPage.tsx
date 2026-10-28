import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingBar } from "@/components/ui/loading";
import { dashboardsApi, type DashboardData } from "@/services/dashboards";
import { pipelineApi, deriveColumn, type PipelineSession } from "@/services/pipeline";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Plus,
  Briefcase,
  Radio,
  ArrowRight,
  ChevronRight,
  Clock,
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Star,
  ClipboardList,
  UserCheck,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toLocalDateStr, toLocalTimeStr, buildMiniGrid, dKey } from "@/utils/calendarHelpers";

// ── Calendar constants ────────────────────────────────────────────────────────

type EventType = "invited" | "started" | "ended" | "failed";

const EVENT_DOT: Record<EventType, string> = {
  invited: "bg-blue-500",
  started: "bg-amber-500",
  ended:   "bg-emerald-500",
  failed:  "bg-rose-500",
};

const EVENT_STYLE: Record<EventType, { bg: string; text: string; Icon: React.ElementType }> = {
  invited: { bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-700 dark:text-blue-300",       Icon: Mail },
  started: { bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-700 dark:text-amber-300",     Icon: Radio },
  ended:   { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
  failed:  { bg: "bg-rose-50 dark:bg-rose-950/30",    text: "text-rose-700 dark:text-rose-300",       Icon: AlertCircle },
};

const PIPELINE_COL_STYLE = {
  invited:      { label: "Invited",     color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  interviewing: { label: "Live",        color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
  evaluated:    { label: "Evaluated",   color: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" },
  shortlisted:  { label: "Shortlisted", color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" },
  hired:        { label: "Hired",       color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
  rejected:     { label: "Rejected",    color: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300" },
};

const WEEK_DAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [sessions, setSessions] = useState<PipelineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  usePageTitle("Dashboard");

  // Calendar state
  const today = new Date();
  const [calYear]  = useState(today.getFullYear());
  const [calMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(dKey(today));

  const loadData = useCallback(async () => {
    try {
      const [dashRes, pipeRes] = await Promise.all([
        dashboardsApi.get(),
        pipelineApi.getSessions(),
      ]);
      setDashData(dashRes.data);
      setSessions(pipeRes.data.sessions);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh when live interviews exist
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasActive = (dashData?.live_interviews?.length ?? 0) > 0;
    if (hasActive) { pollingRef.current = setInterval(loadData, 6000); }
    else if (pollingRef.current) { clearInterval(pollingRef.current); }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [dashData?.live_interviews, loadData]);

  // ── Calendar events derived from sessions ──
  const calEvents = useMemo(() => {
    const map: Record<string, { type: EventType; time: string; session: PipelineSession; label: string }[]> = {};
    for (const s of sessions) {
      const push = (iso: string, type: EventType, label: string) => {
        const date = toLocalDateStr(iso);
        (map[date] ??= []).push({ type, time: iso, session: s, label });
      };
      if (s.created_at) push(s.created_at, "invited", "Candidate invited");
      if (s.started_at) push(s.started_at, "started", "Interview started");
      if (s.ended_at)   push(s.ended_at, s.end_reason === "error" ? "failed" : "ended",
        s.end_reason === "error" ? "Interview failed" : "Interview completed");
    }
    // sort each date by time
    Object.values(map).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [sessions]);

  const miniGrid = useMemo(() => buildMiniGrid(calYear, calMonth), [calYear, calMonth]);
  const todayKey = dKey(today);
  const selectedEvents = calEvents[selectedDate] ?? [];

  // ── Pipeline stage counts ──
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {
      invited: 0, interviewing: 0, evaluated: 0, shortlisted: 0, hired: 0, rejected: 0,
    };
    sessions.forEach(s => { counts[deriveColumn(s)] = (counts[deriveColumn(s)] || 0) + 1; });
    return counts;
  }, [sessions]);

  // Actionable sessions: evaluated but not shortlisted yet (top 3)
  const evaluatedSessions = useMemo(() =>
    sessions.filter(s => deriveColumn(s) === "evaluated").slice(0, 3),
  [sessions]);

  if (loading) return <DashboardSkeleton />;

  if (error || !dashData) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Failed to load dashboard.</p>
        <Button variant="outline" size="sm" onClick={loadData}>Try Again</Button>
      </div>
    );
  }

  const { stats, recent_assessments, recent_sessions } = dashData;
  const completionRate = stats.total_candidates > 0
    ? Math.min(100, Math.round((stats.completed_count / stats.total_candidates) * 100))
    : 0;

  const statItems = [
    {
      label: "Assessments",
      value: stats.total_assessments,
      sub: "Active agendas",
      icon: ClipboardList,
      to: "/assessments",
    },
    {
      label: "Vacancies",
      value: stats.total_vacancies,
      sub: "Target roles",
      icon: Briefcase,
      to: "/vacancies",
    },
    {
      label: "Candidates",
      value: stats.total_candidates,
      sub: stats.active_count > 0 ? `${stats.active_count} active now` : "Total applicants",
      accent: stats.active_count > 0,
      icon: Users,
      to: "/pipeline",
    },
    {
      label: "Completed",
      value: stats.completed_count,
      sub: `${completionRate}% rate`,
      icon: CheckCircle2,
      to: "/assessments",
    },
    {
      label: "Shortlisted",
      value: pipelineCounts["shortlisted"] ?? stats.shortlisted_count ?? 0,
      sub: "In pipeline",
      valueColor: "text-indigo-600 dark:text-indigo-400",
      icon: Star,
      to: "/pipeline",
    },
    {
      label: "Hired",
      value: pipelineCounts["hired"] ?? stats.hired_count ?? 0,
      sub: "Offer accepted",
      valueColor: "text-emerald-600 dark:text-emerald-400",
      icon: UserCheck,
      to: "/pipeline",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      {/* Top Indeterminate Loading Bar during refresh */}
      {refreshing && (
        <div className="absolute -top-6 inset-x-0">
          <LoadingBar />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {today.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
          >
            <RotateCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/vacancies/new")}
          >
            <Briefcase className="h-3.5 w-3.5 mr-1.5" /> New Vacancy
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Assessment
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px border rounded-xl overflow-hidden bg-border">
        {statItems.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              onClick={() => navigate(s.to)}
              className="bg-background px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                  {s.label}
                </span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
              <div className="mt-2">
                <div
                  className={cn(
                    "text-2xl font-bold tabular-nums leading-tight",
                    s.valueColor,
                    s.accent && "text-primary"
                  )}
                >
                  {s.value}
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                  {s.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main 3-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── COL 1+2: Calendar mini + Recent Activity ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Mini Calendar Widget */}
          <SectionCard
            title="This Month"
            linkTo="/calendar"
            linkLabel="Full calendar"
            titleExtra={
              <span className="text-xs text-muted-foreground">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Compact month grid */}
              <div>
                <div className="grid grid-cols-7 mb-1">
                  {WEEK_DAYS_SHORT.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px">
                  {miniGrid.map((day, i) => {
                    const key = dKey(day);
                    const isCurrentMonth = day.getMonth() === calMonth;
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDate;
                    const events = calEvents[key] ?? [];
                    const types = [...new Set(events.map(e => e.type))];
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(key)}
                        className={cn(
                          "flex flex-col items-center py-1 rounded-md transition-colors text-[11px]",
                          isCurrentMonth ? "hover:bg-muted/50" : "opacity-30",
                          isSelected && "bg-primary/10 ring-1 ring-primary/30",
                        )}
                      >
                        <span className={cn(
                          "h-5 w-5 flex items-center justify-center rounded-full font-medium",
                          isToday && "bg-primary text-primary-foreground",
                        )}>
                          {day.getDate()}
                        </span>
                        {types.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {types.slice(0, 3).map(t => (
                              <span key={t} className={cn("h-1 w-1 rounded-full", EVENT_DOT[t])} />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Today's / selected day events */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {selectedDate === todayKey ? "Today's Events" : new Date(selectedDate + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}
                </p>
                {selectedEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 py-2">No activity.</p>
                ) : (
                  selectedEvents.slice(0, 5).map((ev, i) => {
                    const s = EVENT_STYLE[ev.type];
                    const Icon = s.Icon;
                    return (
                      <div key={i} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]", s.bg)}>
                        <Icon className={cn("h-3 w-3 shrink-0", s.text)} />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium truncate block">
                            {ev.session.candidate_name || `Candidate #${ev.session.id}`}
                          </span>
                        </div>
                        <span className="text-muted-foreground shrink-0">{toLocalTimeStr(ev.time)}</span>
                      </div>
                    );
                  })
                )}
                {selectedEvents.length > 5 && (
                  <p className="text-[10px] text-muted-foreground pl-1">+{selectedEvents.length - 5} more</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Recent Sessions */}
          <SectionCard title="Recent Sessions" linkTo="/assessments" linkLabel="View all">
            {recent_sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {recent_sessions.slice(0, 5).map((s) => {
                  const displayName = s.candidate_name || `Candidate #${s.id}`;
                  const handleClick = () => {
                    if (s.status === "active") navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/monitor`);
                    else if (s.status === "ended" && s.end_reason !== "error") navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/portfolio`);
                    else navigate(`/assessments/${s.assessment_id}/invite`);
                  };
                  return (
                    <button key={s.id} onClick={handleClick}
                      className="w-full flex items-center justify-between py-2.5 group text-left">
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.assessment_name || "Interview Session"}</p>
                      </div>
                      <SessionBadge status={s.status} endReason={s.end_reason} />
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── COL 3: Pipeline + Recent Assessments ── */}
        <div className="space-y-6">

          {/* Pipeline Overview Widget */}
          <SectionCard title="Pipeline" linkTo="/pipeline" linkLabel="Full view">
            {/* Stage count badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(Object.entries(PIPELINE_COL_STYLE) as [string, { label: string; color: string }][]).map(([id, style]) => (
                <span key={id} className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", style.color)}>
                  {pipelineCounts[id] ?? 0} {style.label}
                </span>
              ))}
            </div>

            {/* Actionable: evaluated cards */}
            {evaluatedSessions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                  <Star className="h-3 w-3 text-violet-500" /> Ready to shortlist
                </p>
                {evaluatedSessions.map((s) => (
                  <div key={s.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border bg-background hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/portfolio`)}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                        {s.candidate_name || `Candidate #${s.id}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{s.assessment_name}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {evaluatedSessions.length === 0 && pipelineCounts["evaluated"] === 0 && (
              <p className="text-xs text-muted-foreground/60">No candidates awaiting review.</p>
            )}
          </SectionCard>

          {/* Recent Assessments */}
          <SectionCard title="Recent Assessments" linkTo="/assessments" linkLabel="View all">
            {recent_assessments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No assessments yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {recent_assessments.slice(0, 4).map((a) => (
                  <button key={a.id} onClick={() => navigate(`/assessments/${a.id}/invite`)}
                    className="w-full flex items-center justify-between py-2.5 group text-left">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.time_limit_min}m</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {a.candidate_count ?? 0}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  linkTo,
  linkLabel,
  titleExtra,
  children,
}: {
  title: string;
  linkTo: string;
  linkLabel: string;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
          {titleExtra}
        </div>
        <Link
          to={linkTo}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 transition-colors"
        >
          {linkLabel} <ArrowRight className="h-3 w-3 ml-0.5" />
        </Link>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Session Badge ─────────────────────────────────────────────────────────────

function SessionBadge({ status, endReason }: { status: string; endReason?: string | null }) {
  if (status === "active") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-primary shrink-0">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
        </span>
        Live
      </span>
    );
  }
  if (status === "ended" && endReason !== "error") {
    return <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">Done</span>;
  }
  if (status === "ended" && endReason === "error") {
    return <span className="text-[11px] font-medium text-destructive shrink-0">Failed</span>;
  }
  return <span className="text-[11px] font-medium text-muted-foreground shrink-0">Awaiting</span>;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px border rounded-xl overflow-hidden bg-border">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-background p-4 space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-3 rounded-full" />
            </div>
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
