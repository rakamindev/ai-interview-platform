import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/layout/PageHeader";
import PageTransition from "@/components/layout/PageTransition";
import RowList, { RowListSkeleton } from "@/components/layout/RowList";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock } from "lucide-react";
import type { Assessment } from "@/types";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-red-700">Last session failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Last session completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Assessments" subtitle="Skill sets the AI interviewer probes. Open one to invite candidates and review results.">
        <Button asChild className="min-h-11 sm:min-h-9">
          <Link to="/assessments/new">
            <Plus className="h-4 w-4" aria-hidden /> New assessment
          </Link>
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState message="Could not load assessments. Check your connection and try again." onRetry={load} />
      ) : loading ? (
        <RowListSkeleton />
      ) : assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="An assessment is the list of skills and target levels the AI interviewer covers with each candidate."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/assessments/new">Create an assessment</Link>
            </Button>
          }
        />
      ) : (
        <RowList
          label="Assessments"
          items={assessments.map((a) => ({
            key: a.id,
            to: `/assessments/${a.id}/invite`,
            title: a.name,
            meta: (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  {a.time_limit_min} min
                </span>
                {a.latest_session && (
                  <>
                    <span aria-hidden>·</span>
                    <SessionSummary session={a.latest_session} />
                  </>
                )}
              </span>
            ),
          }))}
        />
      )}
    </PageTransition>
  );
}
