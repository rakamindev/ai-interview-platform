import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import {
  CalendarClock,
  CheckCircle2,
  Users2,
  XCircle,
  Briefcase,
  Plus,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import type { Assessment, Vacancy, Session } from "@/types";
import { EMPLOYMENT_TYPE_LABELS, WORKPLACE_TYPE_LABELS } from "@/types";

interface SessionWithAssessment extends Session {
  assessmentName?: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [sessions, setSessions] = useState<SessionWithAssessment[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchDashboardData = async () => {
      try {
        const [assessmentsRes, vacanciesRes] = await Promise.all([
          assessmentsApi.list().catch(() => ({ data: { assessments: [] } })),
          vacanciesApi.list().catch(() => ({ data: { vacancies: [] } })),
        ]);

        if (!mounted) return;
        const fetchedAssessments = assessmentsRes.data.assessments || [];
        const fetchedVacancies = vacanciesRes.data.vacancies || [];

        setAssessments(fetchedAssessments);
        setVacancies(fetchedVacancies);

        // Fetch recent sessions from each assessment
        const sessionPromises = fetchedAssessments.slice(0, 5).map(async (a) => {
          try {
            const sRes = await assessmentsApi.getSessions(a.id);
            return (sRes.data.sessions || []).map((s) => ({
              ...s,
              assessmentName: a.name,
            }));
          } catch {
            return [];
          }
        });

        const nestedSessions = await Promise.all(sessionPromises);
        if (mounted) {
          const allSessions = nestedSessions.flat();
          // Sort newest first
          allSessions.sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
          setSessions(allSessions);
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      mounted = false;
    };
  }, []);

  const totalSessions = sessions.length;
  const doneSessions = sessions.filter((s) => s.status === "ended" && s.end_reason !== "error").length;
  const upcomingSessions = sessions.filter((s) => s.status === "pending" || s.status === "active").length;
  const cancelSessions = sessions.filter((s) => s.status === "ended" && s.end_reason === "error").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200/80 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Live Overview
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Overview of AI interview sessions, ongoing candidate evaluations, and current vacancies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/vacancies/new")} className="shadow-2xs font-medium">
            <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
          </Button>
          <Button size="sm" onClick={() => navigate("/assessments/new")} className="shadow-xs font-medium">
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upcoming Interview */}
        <Card className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Upcoming
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shadow-2xs">
              <CalendarClock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900">{upcomingSessions}</div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Pending or active sessions</p>
          </div>
        </Card>

        {/* Done Interview */}
        <Card className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900">{doneSessions}</div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Interviews completed</p>
          </div>
        </Card>

        {/* Total Interview */}
        <Card className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Sessions
            </span>
            <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 text-primary flex items-center justify-center shadow-2xs">
              <Users2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900">{totalSessions}</div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Across all assessment roles</p>
          </div>
        </Card>

        {/* Cancel / Failed Interview */}
        <Card className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Failed / Error
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shadow-2xs">
              <XCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900">{cancelSessions}</div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Terminated with error</p>
          </div>
        </Card>
      </div>

      {/* Main Sections: Current Vacancies & Recent Candidate Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Current Vacancies */}
        <Card className="lg:col-span-2 border border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Current Vacancies
              </CardTitle>
              <CardDescription className="text-xs">
                Active job positions and role requirement definitions
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary">
              <Link to="/vacancies">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {vacancies.length === 0 ? (
              <div className="border border-dashed rounded-lg p-8 text-center">
                <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-slate-700">No vacancies defined yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Define your first role with required skills to start assessments.
                </p>
                <Button size="sm" onClick={() => navigate("/vacancies/new")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Vacancy
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {vacancies.slice(0, 5).map((v) => (
                  <div
                    key={v.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/70 px-2 rounded-lg transition-colors cursor-pointer"
                    onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">{v.role_title}</span>
                        <span className="text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200/80 px-2 py-0.5 rounded-full">
                          {EMPLOYMENT_TYPE_LABELS[v.employment_type || "full_time"] || "Full-time"}
                        </span>
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80 px-2 py-0.5 rounded-full">
                          {WORKPLACE_TYPE_LABELS[v.workplace_type || "on_site"] || "On-site"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {v.culture_dimensions || "No specific culture description added."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {v.created_at ? new Date(v.created_at).toLocaleDateString() : "-"}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Quick Status / Recent Candidate Activity */}
        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Recent Candidates
              </CardTitle>
              <CardDescription className="text-xs">
                Latest interview invitations & evaluations
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary">
              <Link to="/assessments">
                All <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="border border-dashed rounded-lg p-6 text-center">
                <Users2 className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No candidate sessions recorded yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => navigate("/assessments")}
                >
                  Go to Assessments
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 5).map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900">
                        {s.candidate_name || `Candidate #${idx + 1}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {s.assessmentName || "Role Assessment"}
                      </div>
                    </div>
                    <div>
                      {s.status === "ended" && s.end_reason !== "error" ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                          Completed
                        </Badge>
                      ) : s.status === "active" ? (
                        <Badge variant="outline" className="text-[10px] text-primary bg-primary/10 border-primary/20 animate-pulse">
                          Live Now
                        </Badge>
                      ) : s.status === "ended" && s.end_reason === "error" ? (
                        <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50 border-rose-200">
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                          Awaiting
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
