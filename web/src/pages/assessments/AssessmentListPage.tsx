import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/shared/EmptyState";
import { ListRowCard } from "@/components/shared/ListRowCard";
import { ListControls, ListScroll } from "@/components/shared/ListControls";
import { SessionStatusPill } from "@/components/shared/StatusPill";
import { assessmentsApi } from "@/services/assessments";
import { matchesQuery, sessionListStatus, collectAllPages, type SessionListStatus } from "@/utils/listQuery";
import { Plus, Clock, ClipboardList } from "lucide-react";
import type { Assessment } from "@/types";

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SessionListStatus>("all");
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(false);
    collectAllPages(async (page) => {
      const res = await assessmentsApi.list(page);
      return {
        items: res.data.assessments,
        totalPages: res.data.meta?.total_pages ?? 1,
      };
    })
      .then(setAssessments)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      if (!matchesQuery(a.name, search)) return false;
      if (status === "all") return true;
      return sessionListStatus(a.latest_session) === status;
    });
  }, [assessments, search, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Design interview sessions, invite candidates, and review decision-ready portfolios."
        actions={
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        }
      />

      {error && (
        <ErrorState
          title="Failed to load assessments"
          description="Check your connection and try again."
          onRetry={load}
        />
      )}

      {!error && loading && <LoadingBlock rows={3} />}

      {!error && !loading && assessments.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description="Create your first assessment to define skills, time limits, and invite candidates."
          action={
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          }
        />
      )}

      {!error && !loading && assessments.length > 0 && (
        <div className="space-y-3">
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search assessments"
            status={status}
            onStatusChange={setStatus}
            includeNoneStatus
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No matching assessments"
              description="Try a different name or status."
            />
          ) : (
            <ListScroll className="space-y-2 pr-1">
              {filtered.map((a) => (
                <ListRowCard
                  key={a.id}
                  onClick={() => navigate(`/assessments/${a.id}/invite`)}
                  title={
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                      {a.name}
                    </span>
                  }
                  meta={
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.time_limit_min} min
                      </span>
                      {a.language && (
                        <span className="uppercase tracking-wide text-[10px] border rounded px-1.5 py-0.5">
                          {a.language}
                        </span>
                      )}
                      <SessionStatusPill session={a.latest_session} />
                    </>
                  }
                />
              ))}
            </ListScroll>
          )}
        </div>
      )}
    </div>
  );
}
