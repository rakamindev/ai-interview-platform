import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { PaginationControl } from "@/components/common/PaginationControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/useToast";
import { useUser } from "@/hooks/useUser";
import {
  ClipboardList,
  Plus,
  Clock,
  Search,
  Copy,
  Pencil,
  Trash2,
  Send,
  Loader2,
  Globe,
  Radio,
} from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

export default function AssessmentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error: toastError } = useToast();
  const { canEdit } = useUser();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const currentPage = Number(searchParams.get("page")) || 1;

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await assessmentsApi.list({
        page: currentPage,
        search: searchInput.trim() || undefined,
      });
      setAssessments(res.data.assessments);
      setMeta(res.data.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchInput]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set("search", searchInput.trim());
    else next.delete("search");
    next.set("page", "1");
    setSearchParams(next);
  };

  const handlePageChange = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  };

  const handleDuplicate = async (id: number) => {
    setDuplicatingId(id);
    try {
      const res = await assessmentsApi.duplicate(id);
      success("Assessment duplicated", `Created duplicate: ${res.data.assessment.name}.`);
      fetchAssessments();
    } catch {
      toastError("Duplication failed", "Could not duplicate assessment.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setDeletingInProgress(true);
    try {
      await assessmentsApi.delete(deletingId);
      success("Assessment deleted", "The assessment template has been removed.");
      setDeletingId(null);
      fetchAssessments();
    } catch {
      toastError("Delete failed", "Could not delete assessment.");
    } finally {
      setDeletingInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Structured AI interview rubrics, skills anchors, and assessment templates."
        actions={
          canEdit && (
            <Button onClick={() => navigate("/assessments/new")} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> New Assessment
            </Button>
          )
        }
      />

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:max-w-xs">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assessments..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-9 shrink-0">
            Search
          </Button>
        </form>
      </div>

      {/* Assessment Table */}
      {loading ? (
        <LoadingState rows={5} />
      ) : error ? (
        <ErrorState onRetry={fetchAssessments} title="Failed to load assessments" />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments found"
          description={
            searchInput
              ? "No assessments matching your search query."
              : "Create your first role assessment template to start interviewing candidates."
          }
          actionLabel={searchInput ? "Clear Search" : "Create Assessment"}
          onAction={() => {
            if (searchInput) {
              setSearchInput("");
              setSearchParams({});
            } else {
              navigate("/assessments/new");
            }
          }}
        />
      ) : (
        <Card className="shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Role Title</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4">Latest Session</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assessments.map((a) => {
                    const isLive = a.latest_session?.status === "active";
                    const isEnded = a.latest_session?.status === "ended";

                    return (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-sm text-foreground">{a.name}</div>
                          <span className="text-[10px] text-muted-foreground">
                            Created {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
                            <Clock className="h-3 w-3 text-primary" />
                            {a.time_limit_min} min
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-medium text-[11px]">
                            {a.language === "id" ? "🇮🇩 Bahasa Indonesia" : "🇬🇧 English"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isLive && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-[10px]">
                              <Radio className="h-3 w-3 animate-ping" />
                              Live Now
                            </span>
                          )}
                          {isEnded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px]">
                              Last completed
                            </span>
                          )}
                          {!isLive && !isEnded && (
                            <span className="text-muted-foreground text-[10px]">No sessions yet</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => navigate(`/assessments/${a.id}/invite`)}
                            >
                              <Send className="h-3 w-3 mr-1" /> Invite
                            </Button>

                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Edit assessment"
                                  onClick={() => navigate(`/assessments/${a.id}/edit`)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Duplicate assessment"
                                  disabled={duplicatingId === a.id}
                                  onClick={() => handleDuplicate(a.id)}
                                >
                                  {duplicatingId === a.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  title="Delete assessment"
                                  onClick={() => setDeletingId(a.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t">
              <PaginationControl meta={meta} onPageChange={handlePageChange} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the assessment rubric. Existing candidate sessions linked to this assessment will remain archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInProgress}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingInProgress}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingInProgress && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
