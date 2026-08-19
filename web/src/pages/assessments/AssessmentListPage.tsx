import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, LayoutDashboard } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Failed</span>;

  if (session.status === "ended")
    return <span className="text-xs bg-green-500/10 text-green-700 px-2 py-0.5 rounded-full font-medium">Completed</span>;

  return <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full font-medium">Awaiting candidate</span>;
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1 text-lg">No assessments</h3>
          <p className="mb-6 max-w-sm">Create an assessment to define the role and skills you want to evaluate candidates on.</p>
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate text-base">{a.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1.5">
                    <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_min} min
                    </span>
                    {a.latest_session && (
                      <SessionSummary session={a.latest_session} />
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
