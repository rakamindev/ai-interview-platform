import { useEffect, useState, useCallback } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

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

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const loadAssessments = useCallback(() => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list(currentPage)
      .then((res) => {
        setAssessments(res.data.assessments);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [currentPage]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage interview assessments, target rubrics, and candidate sessions.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Failed to load assessments"
          description="An error occurred while fetching assessments. Please check your connection and try again."
          onRetry={loadAssessments}
        />
      )}

      {loading ? (
        <div className="border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Assessment / Role</th>
                <th className="py-3 px-4 font-semibold">Time Limit</th>
                <th className="py-3 px-4 font-semibold">Latest Session Status</th>
                <th className="py-3 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td className="py-3.5 px-4 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </td>
                  <td className="py-3.5 px-4">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="py-3.5 px-4">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Skeleton className="h-8 w-20 ml-auto rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : assessments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Assessment / Role</th>
                  <th className="py-3 px-4 font-semibold">Time Limit</th>
                  <th className="py-3 px-4 font-semibold">Latest Session Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assessments.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/assessments/${a.id}/invite`)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground">ID: #{a.id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {a.time_limit_min} min
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {a.latest_session ? (
                        <SessionSummary session={a.latest_session} />
                      ) : (
                        <span className="text-muted-foreground">Awaiting candidate</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Manage assessment"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assessments/${a.id}/invite`);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <Pagination
          currentPage={meta.current_page}
          totalPages={meta.total_pages}
          onPageChange={(page) => setSearchParams({ page: String(page) })}
        />
      )}
    </div>
  );
}
