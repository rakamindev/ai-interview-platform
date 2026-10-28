import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  Search,
  X,
  Users,
  Globe,
  ArrowUpDown,
  Filter,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

function AssessmentOverallStatusBadge({ assessment }: { assessment: Assessment }) {
  const status = assessment.overall_status;
  const summary = assessment.candidates_summary;

  if (!summary || summary.total === 0 || status === "no_candidates") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
        No candidates
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="flex items-center gap-1 text-xs text-primary font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live interview ({summary.active} active)
      </span>
    );
  }

  if (status === "uncomplete") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Uncomplete ({summary.completed}/{summary.total} finished)
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        All completed ({summary.total}/{summary.total})
      </span>
    );
  }

  return null;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at">("created_at");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageTitle("Assessments");

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadAssessments = useCallback(
    async (p: number, q: string, st: string, sort: "created_at" | "updated_at") => {
      setLoading(true);
      setError(false);
      try {
        const res = await assessmentsApi.list({
          page: p,
          search: q,
          status: st,
          sort_by: sort,
        });
        setAssessments(res.data.assessments);
        setMeta(res.data.meta);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAssessments(page, searchQuery, statusFilter, sortBy);
  }, [page, searchQuery, statusFilter, sortBy, loadAssessments]);

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("");
    setSortBy("created_at");
    setPage(1);
  };

  const handleDeleteAssessment = async () => {
    if (!deletingAssessment) return;
    setDeleteLoading(true);
    try {
      await assessmentsApi.delete(deletingAssessment.id);
      toast("Assessment deleted successfully");
      setDeletingAssessment(null);
      loadAssessments(page, searchQuery, statusFilter, sortBy);
    } catch {
      toast("Failed to delete assessment", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const isFiltered = Boolean(searchQuery || statusFilter || sortBy !== "created_at");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Assessments</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your AI interview sessions, competencies, and candidate invites.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {/* Search and Filters toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search assessments by role or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9 h-10 w-full bg-background"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Row: Status tabs & Sorting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1 hidden sm:inline-flex items-center gap-1">
              <Filter className="h-3 w-3" /> Status:
            </span>
            {[
              { label: "All", value: "" },
              { label: "Uncomplete", value: "uncomplete" },
              { label: "Completed", value: "completed" },
            ].map((st) => (
              <button
                key={st.value}
                onClick={() => {
                  setStatusFilter(st.value);
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors",
                  statusFilter === st.value
                    ? "bg-primary text-primary-foreground font-medium shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {st.label}
              </button>
            ))}

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset filters
              </Button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <label htmlFor="assessment-sort" className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Sort:</span>
            </label>
            <select
              id="assessment-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as "created_at" | "updated_at");
                setPage(1);
              }}
              className="h-8 text-xs bg-background border border-input rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="created_at">Newest Created (Default)</option>
              <option value="updated_at">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        isFiltered ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground space-y-3">
            <p>
              No assessments matching your filter criteria{" "}
              {searchQuery && (
                <>
                  for &ldquo;<span className="font-semibold text-foreground">{searchQuery}</span>&rdquo;
                </>
              )}
              .
            </p>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Reset all filters
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
            <p className="mb-3">No assessments yet.</p>
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => {
            const count = a.candidate_count ?? 0;
            return (
              <Card
                key={a.id}
                className="cursor-pointer hover:border-primary/40 hover:shadow-xs transition-all"
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-foreground truncate">{a.name}</p>
                      {a.language && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          <Globe className="h-2.5 w-2.5" />
                          {a.language}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.time_limit_min} min
                      </span>

                      <span>·</span>

                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="font-medium text-foreground">{count}</span>{" "}
                        {count === 1 ? "candidate" : "candidates"}
                      </span>

                      <span>·</span>

                      {/* Overall candidate status */}
                      <AssessmentOverallStatusBadge assessment={a} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingAssessment(a);
                      }}
                      title="Delete assessment"
                      aria-label="Delete assessment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {meta && (
        <Pagination
          currentPage={meta.current_page}
          totalPages={meta.total_pages}
          totalCount={meta.total_count}
          perPage={meta.per_page}
          onPageChange={(p) => setPage(p)}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deletingAssessment}
        onOpenChange={(open) => !open && setDeletingAssessment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              <strong className="text-foreground">{deletingAssessment?.name}</strong>
              &rdquo;? All {deletingAssessment?.candidate_count ?? 0} associated candidate sessions, transcripts, and portfolios will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssessment}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Assessment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
