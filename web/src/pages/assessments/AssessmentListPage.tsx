import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10,
  });

  const [assessmentToDelete, setAssessmentToDelete] =
    useState<Assessment | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!assessmentToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await assessmentsApi.delete(assessmentToDelete.id);

      setAssessmentToDelete(null);

      if (assessments.length === 1 && page > 1) {
        setPage((current) => current - 1);
        return;
      }

      const res = await assessmentsApi.list(page, debouncedSearch);

      setAssessments(res.data.assessments);
      setMeta(res.data.meta);
    } catch (e: any) {
      setDeleteError(
        e?.response?.data?.errors?.[0]?.message ??
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        "Failed to delete assessment."
      );
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(false);

    assessmentsApi
      .list(page, debouncedSearch)
      .then((res) => {
        if (cancelled) return;

        setAssessments(res.data.assessments);
        setMeta(res.data.meta);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search assessments..."
          className="pl-9"
        />
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
          {debouncedSearch ? (
            <>
              <p className="font-medium text-foreground">
                No assessments found
              </p>
              <p className="mt-1">
                No results match "{debouncedSearch}".
              </p>
            </>
          ) : (
            <>
              <p className="mb-3">No assessments yet.</p>

              <Button
                variant="outline"
                onClick={() => navigate("/assessments/new")}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create your first assessment
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between">
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
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete assessment"
                    onClick={(e) => {
                      e.stopPropagation();

                      setDeleteError(null);
                      setAssessmentToDelete(a);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}

          {meta.total_count > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {(meta.current_page - 1) * meta.per_page + 1}
                {"–"}
                {Math.min(
                  meta.current_page * meta.per_page,
                  meta.total_count
                )}{" "}
                of {meta.total_count}
              </p>

              {meta.total_pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <span className="text-xs text-muted-foreground px-2">
                    Page {meta.current_page} of {meta.total_pages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= meta.total_pages || loading}
                    onClick={() =>
                      setPage((p) => Math.min(meta.total_pages, p + 1))
                    }
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!assessmentToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setAssessmentToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete assessment?</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Assessment{" "}
              <span className="font-medium text-foreground">
                {assessmentToDelete?.name}
              </span>{" "}
              will be deleted.
            </p>

            <p className="text-xs text-muted-foreground">
              This action cannot be undone.
            </p>

            {deleteError && (
              <p className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setAssessmentToDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}

              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
