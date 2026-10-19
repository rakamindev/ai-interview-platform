import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import type { Assessment } from "@/types";
import { cn } from "@/lib/utils";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
          aria-hidden
        />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="text-xs font-medium text-destructive">Last failed</span>
    );

  if (session.status === "ended")
    return (
      <span className="text-xs font-medium text-success">Last completed</span>
    );

  return (
    <span className="text-xs text-muted-foreground">Awaiting candidate</span>
  );
}

function AssessmentCard({
  assessment,
  onOpen,
}: {
  assessment: Assessment;
  onOpen: (id: number) => void;
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(assessment.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(assessment.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer rounded-xl border border-border bg-white p-5 sm:p-6",
        "shadow-sm shadow-black/[0.03]",
        "transition-all duration-200 ease-out",
        "hover:border-primary/30 hover:shadow-md hover:shadow-primary/[0.06]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="font-semibold text-base text-foreground leading-snug break-words">
            {assessment.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {assessment.time_limit_min} min
            </span>
            {assessment.latest_session && (
              <>
                <span className="text-border hidden sm:inline" aria-hidden>
                  ·
                </span>
                <SessionSummary session={assessment.latest_session} />
              </>
            )}
          </div>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary mt-0.5"
          aria-hidden
        />
      </div>
    </div>
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

  const openAssessment = (id: number) => {
    navigate(`/assessments/${id}/invite`);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Assessments
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Manage and track your interview assessments.
          </p>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="w-full sm:w-auto shrink-0 font-medium"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Assessment
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 border border-destructive/30 bg-destructive/5 rounded-xl p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <p>Failed to load assessments. Please refresh the page.</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading assessments">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 sm:py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-muted">
            <ClipboardList className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            No assessments yet
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Create your first assessment to start inviting candidates to AI
            interviews.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/assessments/new")}
            className="rounded-[10px] focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create your first assessment
          </Button>
        </div>
      ) : (
        <ul className="space-y-3 list-none m-0 p-0">
          {assessments.map((a) => (
            <li key={a.id}>
              <AssessmentCard assessment={a} onOpen={openAssessment} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
