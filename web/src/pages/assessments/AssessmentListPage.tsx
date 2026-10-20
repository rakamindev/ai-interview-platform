import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AssessmentFormDialog from "@/components/assessment/AssessmentFormDialog";
import ListToolbar from "@/components/workspace/ListToolbar";
import MetricStrip from "@/components/workspace/MetricStrip";
import PaginationControls from "@/components/workspace/PaginationControls";
import { assessmentsApi } from "@/services/assessments";
import { showRequestError } from "@/lib/requestToast";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle2, Clock, Edit3, FileText, Plus, Radio, RefreshCw } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

type AssessmentStatusFilter = "all" | "live" | "completed" | "awaiting";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="text-xs text-muted-foreground">No sessions yet</span>;
  if (session.status === "active") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Live now</span>;
  if (session.status === "ended" && session.end_reason === "error") return <span className="text-xs font-medium text-destructive">Last session failed</span>;
  if (session.status === "ended") return <span className="text-xs text-muted-foreground">Last session completed</span>;
  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, total_pages: 1, total_count: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssessmentStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; id?: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadAssessments = () => {
    setLoading(true);
    setError(false);
    assessmentsApi.list({ page, search, status })
      .then((res) => {
        setAssessments(res.data.assessments);
        setMeta(res.data.meta ?? { current_page: page, total_pages: 1, total_count: res.data.assessments.length, per_page: res.data.assessments.length });
      })
      .catch((requestError) => {
        setError(true);
        showRequestError(requestError, "Couldn’t load assessments.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadAssessments, [page, search, status]);

  const counts = useMemo(() => ({
    live: assessments.filter((assessment) => assessment.latest_session?.status === "active").length,
    completed: assessments.filter((assessment) => assessment.latest_session?.status === "ended").length,
    awaiting: assessments.filter((assessment) => assessment.latest_session?.status === "pending").length,
  }), [assessments]);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary"><FileText className="mr-1.5 h-3 w-3" />Assessor workspace</Badge>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Design interview scopes, invite candidates, and review evidence.</p>
        </div>
        <Button className="h-11" onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> New assessment</Button>
      </div>

      <MetricStrip items={[
        { label: "Total assessments", value: meta.total_count, icon: BarChart3, className: "text-foreground" },
        { label: "Live on page", value: counts.live, icon: Radio, className: "text-primary" },
        { label: "Completed on page", value: counts.completed, icon: CheckCircle2, className: "text-primary" },
        { label: "Awaiting on page", value: counts.awaiting, icon: Clock, className: "text-muted-foreground" },
      ]} />

      <ListToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search assessments by role title"
        filterLabel="Session status"
        filterValue={status}
        onFilterChange={(value) => { setStatus(value as AssessmentStatusFilter); setPage(1); }}
        filterOptions={[
          { value: "all", label: "All statuses" },
          { value: "live", label: "Live now" },
          { value: "completed", label: "Completed" },
          { value: "awaiting", label: "Awaiting candidate" },
        ]}
        resultCount={assessments.length}
      />

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full rounded-2xl" />)}</div>
      ) : error ? (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <div><p className="font-medium text-destructive">Failed to load assessments. Please refresh the page.</p><p className="mt-1 text-sm text-muted-foreground">Retry without losing your filters.</p></div>
          <Button variant="outline" onClick={loadAssessments}><RefreshCw className="h-4 w-4" /> Retry</Button>
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{search || status !== "all" ? "No assessments match these filters." : "No assessments yet."}</p>
          <p className="mt-1 text-sm text-muted-foreground">Create an assessment to start a structured interview.</p>
          {search || status !== "all" ? <Button variant="outline" className="mt-4" onClick={() => { setSearchInput(""); setStatus("all"); }}>Clear filters</Button> : <Button className="mt-4" onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Create assessment</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <Card key={assessment.id} className="rounded-2xl border-border/80 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <button type="button" aria-label={`Open ${assessment.name}`} className="min-w-0 flex-1 text-left" onClick={() => navigate(`/assessments/${assessment.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/assessments/${assessment.id}`); } }}>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-semibold">{assessment.name}</h2>{assessment.latest_session?.status === "active" && <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10"><Radio className="h-3 w-3" />Live</Badge>}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{assessment.time_limit_min} minutes</span><span>{assessment.language === "id" ? "Indonesian" : "English"}</span><SessionSummary session={assessment.latest_session} /></div>
                </button>
                <Button variant="outline" className="h-10 shrink-0" onClick={() => setDialog({ mode: "edit", id: assessment.id })}><Edit3 className="h-4 w-4" /> Edit</Button>
              </CardContent>
            </Card>
          ))}
          <PaginationControls meta={meta} onPageChange={setPage} />
        </div>
      )}

      <AssessmentFormDialog mode={dialog?.mode ?? "create"} assessmentId={dialog?.id} open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }} onSaved={loadAssessments} />
    </div>
  );
}
