import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Plus, Radio, Users } from "lucide-react";
import type { Assessment } from "@/types";

function SessionBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">No session</span>;
  if (session.status === "active") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>;
  if (session.status === "ended" && session.end_reason === "error") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Needs review</span>;
  if (session.status === "ended") return <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Completed</span>;
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true); setError(false);
    assessmentsApi.list().then((res) => setAssessments(res.data.assessments)).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const metrics = useMemo(() => ({
    total: assessments.length,
    live: assessments.filter((a) => a.latest_session?.status === "active").length,
    completed: assessments.filter((a) => a.latest_session?.status === "ended" && a.latest_session?.end_reason !== "error").length,
  }), [assessments]);

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Assessment workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Interview evidence, without the guesswork.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Create structured interviews, monitor candidate sessions, and review evidence before any fit/gap conclusion is used.</p>
          </div>
          <Button className="h-11" onClick={() => navigate("/assessments/new")}><Plus className="mr-2 h-4 w-4" />New assessment</Button>
        </div>
        <div className="grid border-t sm:grid-cols-3">
          <div className="flex items-center gap-3 border-b p-5 sm:border-b-0 sm:border-r"><div className="rounded-2xl bg-slate-100 p-2.5"><Users className="h-4 w-4" /></div><div><p className="text-2xl font-semibold">{metrics.total}</p><p className="text-xs text-muted-foreground">Assessments</p></div></div>
          <div className="flex items-center gap-3 border-b p-5 sm:border-b-0 sm:border-r"><div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-700"><Radio className="h-4 w-4" /></div><div><p className="text-2xl font-semibold">{metrics.live}</p><p className="text-xs text-muted-foreground">Live sessions</p></div></div>
          <div className="flex items-center gap-3 p-5"><div className="rounded-2xl bg-primary/10 p-2.5 text-primary"><CheckCircle2 className="h-4 w-4" /></div><div><p className="text-2xl font-semibold">{metrics.completed}</p><p className="text-xs text-muted-foreground">Completed</p></div></div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Recent assessments</h2><p className="text-sm text-muted-foreground">Open an assessment to invite or review a candidate.</p></div></div>

        {error && <div className="flex items-center justify-between gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4"><div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Assessments could not be loaded.</div><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>}

        {loading ? (
          <div className="grid gap-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : assessments.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><h3 className="mt-4 font-semibold">No assessments yet</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Start with a role, define the skills that matter, then invite a candidate into a structured interview.</p><Button className="mt-5" onClick={() => navigate("/assessments/new")}><Plus className="mr-2 h-4 w-4" />Create assessment</Button></div>
        ) : (
          <div className="grid gap-3">
            {assessments.map((a) => (
              <Card key={a.id} className="group cursor-pointer overflow-hidden border-slate-200 shadow-none transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm" onClick={() => navigate(`/assessments/${a.id}/invite`)}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 sm:flex"><Clock3 className="h-5 w-5 text-slate-600" /></div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{a.name}</p><SessionBadge session={a.latest_session} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{a.time_limit_min} min interview</span>{a.language && <span>{a.language.toUpperCase()} language</span>}{a.skills && <span>{a.skills.length} configured skills</span>}</div></div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary"><ArrowUpRight className="h-4 w-4" /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
