import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/layout/PageHeader";
import StatePanel from "@/components/layout/StatePanel";
import ListRow from "@/components/layout/ListRow";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Trash2 } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({
  assessmentId,
  session,
}: {
  assessmentId: number;
  session?: Assessment["latest_session"];
}) {
  const navigate = useNavigate();
  if (!session) return null;

  if (session.status === "active")
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`);
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </button>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Last: failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Last: completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await assessmentsApi.delete(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: { message?: string }[]; error?: string } } };
      const message =
        axiosErr.response?.data?.errors?.[0]?.message ||
        axiosErr.response?.data?.error ||
        "Failed to delete assessment.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        subtitle="Configure interviews and invite candidates."
        actions={
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        }
      />

      {error && (
        <StatePanel
          variant="error"
          title="Could not load assessments"
          description="Refresh the page and try again."
        />
      )}

      {deleteError && (
        <StatePanel variant="error" title="Delete failed" description={deleteError} />
      )}

      {loading ? (
        <div className="border border-foreground/10 divide-y divide-foreground/10 bg-card/40">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3.5 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <StatePanel
          variant="empty"
          title="No assessments yet"
          description="Create one to define skills, time limit, and invite links."
          actions={
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          }
        />
      ) : (
        <div className="border border-foreground/10 bg-card/30">
          {assessments.map((a) => (
            <ListRow
              key={a.id}
              className="cursor-pointer"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
              title={a.name}
              meta={
                <>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.time_limit_min} min
                  </span>
                  {a.latest_session && (
                    <>
                      <span aria-hidden>·</span>
                      <SessionSummary assessmentId={a.id} session={a.latest_session} />
                    </>
                  )}
                </>
              }
              trailing={
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === a.id}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes &ldquo;{a.name}&rdquo; and all of its sessions,
                          transcripts, and portfolios. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(a.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
