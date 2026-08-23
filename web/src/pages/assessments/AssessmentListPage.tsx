import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, ClipboardList } from "lucide-react";
import { m } from "@/(paraglide)/messages.js";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
        <span className="flex items-center gap-1 text-xs text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        {m.assessment.live_now()}
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">{m.assessment.last_failed()}</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">{m.assessment.last_completed()}</span>;

  return <span className="text-xs text-muted-foreground">{m.assessment.awaiting_candidate()}</span>;
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
    <main>
      <PageHeader
        title={m.nav.assessments()}
        description="Skill-based interview templates and their candidate sessions."
        actions={
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> {m.assessment.new()}
          </Button>
        }
      />

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive mb-4">
          {m.assessment.failed_to_load()}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={m.assessment.no_assessments()}
          description="Create an assessment to start inviting candidates to AI-led interviews."
          actionLabel={m.assessment.create_first()}
          onAction={() => navigate("/assessments/new")}
        />
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => (
            <Link
              key={a.id}
              to={`/assessments/${a.id}/invite`}
              className="block rounded-xl border bg-card text-card-foreground shadow hover:border-primary/40 hover:shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
