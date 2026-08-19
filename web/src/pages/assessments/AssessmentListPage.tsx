import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";

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
  const { user } = useAtomValue(authAtom);
  const isAdmin = user?.role === "admin";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Assessments</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            {isAdmin
              ? "Manage all platform interview assessments"
              : "Assessments assigned to you"}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => navigate("/assessments/new")}
            className="w-full sm:w-auto h-9 text-xs font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        )}
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground bg-card">
          <p className="font-medium text-foreground mb-1">
            {isAdmin ? "No assessments created yet" : "No assigned assessments"}
          </p>
          <p className="text-xs mb-4">
            {isAdmin
              ? "Get started by creating your first interview assessment."
              : "You will see interview assessments here once an assessor assigns them to you."}
          </p>
          {isAdmin && (
            <Button size="sm" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
              onClick={() => {
                if (isAdmin) {
                  navigate(`/assessments/${a.id}/invite`);
                } else if (
                  a.latest_session?.invite_token &&
                  a.latest_session.status !== "ended"
                ) {
                  navigate(`/interview/${a.latest_session.invite_token}`);
                }
              }}
            >
              <CardContent className="py-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-foreground truncate">
                    {a.name}
                  </p>
                  <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5 text-primary" />
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
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-1.5 sm:pt-0 border-t sm:border-t-0">
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto h-8 sm:h-7 px-3 text-xs font-medium"
                    >
                      Manage Invites &amp; Results →
                    </Button>
                  ) : a.latest_session?.status === "pending" ? (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto h-8 sm:h-7 px-3 text-xs font-semibold"
                    >
                      Start Interview →
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
