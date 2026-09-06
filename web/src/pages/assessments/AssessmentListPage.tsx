import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Trash2, Loader2 } from "lucide-react";
import type { Assessment } from "@/types";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Assessment | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: number; message: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const openDeleteDialog = (assessment: Assessment) => {
    setDeleteError(null);
    setConfirmTarget(assessment);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id;

    setDeletingId(id);
    setDeleteError(null);
    try {
      await assessmentsApi.delete(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
      setConfirmTarget(null);
    } catch (e: any) {
      setDeleteError({
        id,
        message: e?.response?.data?.errors?.[0]?.message ?? "Failed to delete assessment.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
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
                  <div className="flex items-center gap-2">
                    {deletingId === a.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <button
                      type="button"
                      aria-label={`Delete ${a.name}`}
                      disabled={deletingId !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(a);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {deleteError && deleteError.id === a.id && (
                  <p className="text-xs text-destructive mt-2">{deleteError.message}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              <span>&quot;{confirmTarget?.name}&quot; will be permanently deleted.</span>
              {deleteError && deleteError.id === confirmTarget?.id && (
                <span className="mt-2 block text-destructive">{deleteError.message}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
            >
              {deletingId !== null && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}