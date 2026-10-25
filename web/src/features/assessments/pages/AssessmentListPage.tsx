import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-content";
import EmptyState from "@/components/shared/empty-state";
import { useAssessmentsQuery } from "../hooks/useAssessmentsQuery";
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
    return <span className="text-xs text-destructive">Error</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Completed</span>;

  return null;
}

export default function AssessmentListPage() {
  const { data: assessments = [], isLoading, isError } = useAssessmentsQuery();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        subtitle="Manage competency rubrics, invite candidates, and evaluate interview sessions."
      >
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </PageHeader>

      {isError && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No assessments yet"
          description="Create your first assessment rubric with competency levels and behavioral anchors."
          actionLabel="Create Assessment"
          onAction={() => navigate("/assessments/new")}
        />
      ) : (
        <div className="space-y-2.5">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-xs"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-3.5 px-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">{a.name}</p>
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
    </div>
  );
}
