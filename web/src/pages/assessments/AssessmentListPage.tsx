import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StateView from "@/components/StateView";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assessmentsApi.list();
      if (!Array.isArray(res.data?.assessments)) {
        throw new Error("Assessment response did not contain a list.");
      }
      setAssessments(res.data.assessments);
    } catch {
      setError("Failed to load assessments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button className="min-h-10 w-full sm:min-h-9 sm:w-auto" onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      <StateView
        loading={loading}
        error={error}
        onRetry={() => void loadAssessments()}
        empty={assessments.length === 0}
        loadingContent={
          <div className="space-y-2" aria-label="Loading assessments" role="status">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-5 shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
        emptyContent={
          <div className="text-sm text-muted-foreground">
            <p className="mb-3">No assessments yet.</p>
            <Button variant="outline" className="min-h-10" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {assessments.map((a) => (
            <Card key={a.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  onClick={() => navigate(`/assessments/${a.id}/invite`)}
                  aria-label={`Open assessment ${a.name}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sm" title={a.name}>{a.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.time_limit_min} min
                      </span>
                      {a.latest_session && (
                        <>
                          <span aria-hidden="true">·</span>
                          <SessionSummary session={a.latest_session} />
                        </>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </StateView>
    </div>
  );
}
