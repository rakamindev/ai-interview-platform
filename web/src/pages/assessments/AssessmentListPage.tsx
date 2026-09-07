import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Users } from "lucide-react";
import SessionHealthBadge, { sessionHealth } from "@/components/assessment/SessionHealth";
import type { Assessment } from "@/types";

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
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{a.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {a.time_limit_min} min
                    </span>
                    {typeof a.session_count === "number" && a.session_count > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden="true" />
                          {a.session_count} candidate{a.session_count !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                    {a.latest_session && (
                      <>
                        <span aria-hidden="true">·</span>
                        <SessionHealthBadge session={a.latest_session} timeLimitMin={a.time_limit_min} />
                      </>
                    )}
                  </div>
                  {/* Only rows that need something say more than their status. */}
                  {sessionHealth(a.latest_session, a.time_limit_min)?.detail && (
                    <p className="mt-1 text-xs text-amber-700">
                      {sessionHealth(a.latest_session, a.time_limit_min)!.detail}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
