import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ClipboardList, Users } from "lucide-react";
import type { Assessment } from "@/types";
import { LoadingStateAsesment } from "@/components/loaderState/component";
import { EmptyStateAsesment } from "@/components/emptyState/component";
import { CardUi } from "@/components/cardUi/component";

function SessionSummary({
  session,
}: {
  session?: Assessment["latest_session"];
}) {
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
    return (
      <span className="text-xs text-muted-foreground">Last: completed</span>
    );

  return (
    <span className="text-xs text-muted-foreground">Awaiting candidate</span>
  );
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
        <div className="p-4 text-sm border rounded-lg border-destructive/40 text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading && <LoadingStateAsesment />}

      {assessments.length === 0 ? (
        <EmptyStateAsesment navigate={navigate} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assessments.map((a) => (
            <CardUi
              key={a.id}
              id={a.id}
              Icon={ClipboardList}
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <div className="mt-4">
                <h3 className="text-base font-semibold leading-6 tracking-tight transition-colors line-clamp-2 min-h-12 group-hover:text-primary">
                  {a.name}
                </h3>

                <div className="flex flex-wrap items-center mt-3 text-xs gap-x-4 gap-y-2 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {a.time_limit_min} min
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    Interview assessment
                  </span>
                </div>
              </div>

              {/* Latest session */}
              <div className="flex items-center pt-3 mt-4 border-t min-h-10 border-border/70">
                {a.latest_session ? (
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium">Latest session</p>
                    <SessionSummary session={a.latest_session} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No interview sessions yet
                  </p>
                )}
              </div>
            </CardUi>
          ))}
        </div>
      )}
    </div>
  );
}
