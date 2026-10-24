import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { assessmentsApi } from "@/services/assessments";
import { Activity, AlertTriangle, CheckCircle2, Clock, ChevronRight, Plus, Radio } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = assessments.filter((a) => a.latest_session?.status === "active").length;
  const completedCount = assessments.filter((a) => a.latest_session?.status === "ended" && a.latest_session.end_reason !== "error").length;
  const issueCount = assessments.filter((a) => a.latest_session?.status === "ended" && a.latest_session.end_reason === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Workspace overview</p>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor candidate progress and focus on sessions that need attention.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => navigate("/assessments/new")}>
          <Plus className="mr-1.5 h-4 w-4" /> New Assessment
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total assessments</span><Activity className="h-4 w-4 text-muted-foreground" /></div><p className="mt-2 text-2xl font-semibold">{assessments.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Live sessions</span><Radio className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold">{activeCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Completed</span><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div><p className="mt-2 text-2xl font-semibold">{completedCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Needs attention</span><AlertTriangle className="h-4 w-4 text-destructive" /></div><p className="mt-2 text-2xl font-semibold">{issueCount}</p></CardContent></Card>
          </div>

          {assessments.length === 0 ? (
            <div className="rounded-lg border p-12 text-center text-sm text-muted-foreground">
              <p className="mb-3">No assessments yet.</p>
              <Button variant="outline" onClick={() => navigate("/assessments/new")}>
                <Plus className="mr-1.5 h-4 w-4" /> Create your first assessment
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div><CardTitle className="text-base">Recent assessments</CardTitle><p className="mt-1 text-sm text-muted-foreground">Open an assessment to review candidates and session evidence.</p></div>
                <Badge variant="outline">{assessments.length} total</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {assessments.map((a) => (
                  <button type="button" key={a.id} className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30" onClick={() => navigate(`/assessments/${a.id}/invite`)}>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{a.name}</span><span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {a.time_limit_min} min {a.latest_session && <><span>·</span><SessionSummary session={a.latest_session} /></>}</span></span>
                    <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
