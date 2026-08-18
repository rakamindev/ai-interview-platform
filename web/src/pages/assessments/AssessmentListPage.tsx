import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";
import { useAssessmentListPage } from "@/pages/assessments/useAssessmentListPage";

const SessionSummary = React.memo(({ session }: { session?: Assessment["latest_session"] }) => {
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
})

export default function AssessmentListPage() {
  const navigate = useNavigate();
  const { assessments, loading, error, getAssessments } = useAssessmentListPage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Unable to load assessments. We couldn't retrieve your assessments. Please try again.
          <Button className="mt-3" variant="destructiveOutline" onClick={getAssessments}>
            Try Again
          </Button>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : assessments.length === 0 ? (
            <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
              <p className="mb-3">No assessments yet.</p>
              <Button variant="outline" onClick={() => navigate("/assessments/new")}>
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
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="w-full">
                      <p className="font-medium text-sm truncate">{a.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {a.time_limit_min} min
                        </span>
                        {a.latest_session && (
                          <>
                            <span>·</span>
                            <SessionSummary session={a.latest_session} />
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
