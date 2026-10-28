import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
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

  const gridClass =
    "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Manage interviews and follow candidate progress.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => navigate("/assessments/new")}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className={gridClass}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="rounded-xl shadow-none">
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center text-sm text-muted-foreground sm:px-10">
          <p className="mb-3">No assessments yet.</p>
          <Button
            variant="outline"
            onClick={() => navigate("/assessments/new")}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first assessment
          </Button>
        </div>
      ) : (
        <div className={gridClass}>
          {assessments.map((a) => (
            <Card
              key={a.id}
              role="button"
              tabIndex={0}
              className="flex h-full cursor-pointer flex-col rounded-xl shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/assessments/${a.id}/invite`);
                }
              }}
            >
              <CardContent className="flex flex-1 items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-5">
                    {a.name}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_min} min
                    </span>
                    {a.latest_session && (
                      <SessionSummary session={a.latest_session} />
                    )}
                  </div>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
