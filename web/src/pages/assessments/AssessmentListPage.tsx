import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList, Clock, Languages, Plus, UserCheck, Users } from "lucide-react";
import NeedsReviewSection from "@/components/review/NeedsReviewSection";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { assessmentsApi } from "@/services/assessments";
import { formatDate } from "@/utils/datetime";
import type { Assessment } from "@/types";
import { useRetryFocus } from "@/hooks/useRetryFocus";

const LANGUAGE_LABELS: Record<string, string> = { en: "English", id: "Indonesian" };

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <StatusBadge tone="neutral">No candidates yet</StatusBadge>;
  if (session.status === "active") return <StatusBadge tone="info">Live now</StatusBadge>;
  if (session.status === "ended" && session.end_reason === "error") return <StatusBadge tone="danger">Last: failed</StatusBadge>;
  if (session.status === "ended") return <StatusBadge tone="success">Last: completed</StatusBadge>;
  return <StatusBadge tone="warning">Awaiting candidate</StatusBadge>;
}

function AssessmentMeta({ assessment }: { assessment: Assessment }) {
  return (
    <>
      <span className="flex items-center gap-1"><Clock aria-hidden="true" className="h-3 w-3" />{assessment.time_limit_min} min</span>
      {assessment.language && (
        <span className="flex items-center gap-1"><Languages aria-hidden="true" className="h-3 w-3" />{LANGUAGE_LABELS[assessment.language] ?? assessment.language}</span>
      )}
      {assessment.created_at && (
        <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="h-3 w-3" />Created {formatDate(assessment.created_at)}</span>
      )}
      {assessment.candidate_count !== undefined && (
        <span className="flex items-center gap-1">
          <Users aria-hidden="true" className="h-3 w-3" />
          {`${assessment.candidate_count} ${assessment.candidate_count === 1 ? "candidate" : "candidates"}`}
        </span>
      )}
      {(assessment.needs_review_count ?? 0) > 0 ? (
        <StatusBadge tone="warning">{`${assessment.needs_review_count} need review`}</StatusBadge>
      ) : (assessment.candidate_count ?? 0) > 0 && assessment.needs_review_count === 0 ? (
        <StatusBadge tone="success" icon={UserCheck}>All reviewed</StatusBadge>
      ) : null}
    </>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);
  const { headingRef, markRetry } = useRetryFocus(loading);

  const newButton = (
    <Button asChild>
      <Link to="/assessments/new"><Plus aria-hidden="true" />New Assessment</Link>
    </Button>
  );

  return (
    <PageShell>
      <PageHeader ref={headingRef} title="Assessments" description="Interviews you send to candidates. Open one to invite candidates and read their results."
                  actions={newButton} />

      <NeedsReviewSection />

      <h2 className="text-lg font-semibold">All assessments</h2>

      {loading ? (
        <div aria-busy="true" aria-label="Loading assessments" className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : error ? (
        <ErrorState title="Could not load assessments" description="Check your connection, then try again." onRetry={() => { markRetry(); load(); }} />
      ) : assessments.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assessments yet" className="bg-card"
                    description="Create an assessment to choose the skills to interview for, then invite candidates."
                    action={<Button asChild variant="outline"><Link to="/assessments/new"><Plus aria-hidden="true" />Create your first assessment</Link></Button>} />
      ) : (
        <ul className="space-y-2">
          {assessments.map((a) => (
            <ListRow key={a.id} to={`/assessments/${a.id}/invite`} title={a.name}
                     meta={<AssessmentMeta assessment={a} />} status={<SessionSummary session={a.latest_session} />} />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
