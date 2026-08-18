import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, ClipboardList } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;
  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </span>
    );
  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Last: failed</span>;
  if (session.status === "ended")
    return <span className="text-xs text-green-600">Last: completed</span>;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
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
        <div className="border rounded-lg p-12 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No assessments yet</p>
            <p className="text-xs text-muted-foreground">
              Create your first assessment to start inviting candidates.
            </p>
          </div>
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
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_min} min
                    </span>
                    {(a.skills?.length ?? 0) > 0 && (
                      <>
                        <span>·</span>
                        <span>{a.skills!.length} skill{a.skills!.length !== 1 ? "s" : ""}</span>
                      </>
                    )}
                    {a.latest_session && (
                      <>
                        <span>·</span>
                        <SessionSummary session={a.latest_session} />
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
