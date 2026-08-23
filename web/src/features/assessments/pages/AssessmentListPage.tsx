import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import PageHeader from "@/shared/components/PageHeader";
import EmptyState from "@/shared/components/EmptyState";
import ErrorState from "@/shared/components/ErrorState";
import StatCard from "@/shared/components/StatCard";
import StatsGrid from "@/shared/components/StatsGrid";
import StatsGridSkeleton from "@/shared/components/StatsGridSkeleton";
import EntityListCard from "@/shared/components/EntityListCard";
import ListRowSkeleton from "@/shared/components/ListRowSkeleton";
import SearchInput from "@/shared/components/SearchInput";
import Pagination from "@/shared/components/Pagination";
import { assessmentsApi, type AssessmentStats } from "@/features/assessments/services/assessments";
import { formatDateTime } from "@/shared/lib/utils";
import { Plus, Clock, ClipboardList, UserRound, Radio } from "lucide-react";
import type { Assessment } from "@/features/assessments/types";
import type { PaginationMeta } from "@/shared/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
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

  if (session.expired)
    return <span className="text-xs text-destructive">Invite expired</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [stats, setStats] = useState<AssessmentStats | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list(page, q)
      .then((res) => {
        setAssessments(res.data.assessments);
        setMeta(res.data.meta);
        setStats(res.data.stats);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, q]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Assessments"
        actions={
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        }
      />

      {error ? (
        <ErrorState message="Failed to load assessments." onRetry={load} />
      ) : (
        <>
          <SearchInput
            placeholder="Search assessments..."
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />

          {loading ? (
            <StatsGridSkeleton columns={3} />
          ) : (
            assessments.length > 0 && (
              <StatsGrid columns={3}>
                <StatCard icon={ClipboardList} label="Total Assessments" value={meta?.total_count ?? assessments.length} />
                <StatCard icon={UserRound} label="Total Candidates" value={stats?.total_candidates ?? 0} accent="secondary" />
                <StatCard icon={Radio} label="Live Now" value={stats?.live_now ?? 0} live={!!stats?.live_now} />
              </StatsGrid>
            )
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <ListRowSkeleton key={i} />)}
            </div>
          ) : assessments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              message={q ? `No assessments match "${q}".` : "No assessments yet."}
              description={q ? "Try a different search term." : "Create your first assessment to get started."}
              actionLabel={q ? undefined : "Create your first assessment"}
              onAction={q ? undefined : () => navigate("/assessments/new")}
            />
          ) : (
            <div className="space-y-3">
              {assessments.map((a) => (
                <EntityListCard
                  key={a.id}
                  onClick={() => navigate(`/assessments/${a.id}/invite`)}
                  title={a.name}
                  badges={a.skill_labels}
                  timestamp={
                    a.updated_at
                      ? `Updated${a.updated_by_email ? ` by ${a.updated_by_email}` : ""} · ${formatDateTime(a.updated_at)}`
                      : undefined
                  }
                  meta={
                    <>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.time_limit_min} min
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {a.sessions_count ?? 0} candidates
                      </span>
                      {a.latest_session && (
                        <>
                          <span>·</span>
                          <SessionSummary session={a.latest_session} />
                        </>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          )}

          {meta && <Pagination currentPage={meta.current_page} totalPages={meta.total_pages} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}
