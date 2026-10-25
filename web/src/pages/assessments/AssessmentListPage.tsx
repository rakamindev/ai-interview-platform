import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { Alert, AlertContent } from "@/components/ui/alert";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";

type FilterStatus = "all" | "completed" | "awaiting" | "failed";

function getDisplayStatus(a: Assessment): FilterStatus {
  if (!a.latest_session) return "awaiting";
  if (a.latest_session.status === "active") return "awaiting";
  if (a.latest_session.status === "ended" && a.latest_session.end_reason === "error") return "failed";
  if (a.latest_session.status === "ended") return "completed";
  return "awaiting";
}

const STATUS_BADGE: Record<FilterStatus, { badge: string; label: string }> = {
  completed: { badge: "bg-teal-50 text-teal-700", label: "Completed" },
  awaiting: { badge: "bg-amber-50 text-amber-700", label: "Awaiting" },
  failed: { badge: "bg-red-50 text-red-700", label: "Failed" },
  all: { badge: "", label: "" },
};

const ICON_COLORS = [
  { bg: "bg-teal-50", stroke: "text-teal-700" },
  { bg: "bg-blue-50", stroke: "text-blue-700" },
  { bg: "bg-purple-50", stroke: "text-purple-700" },
  { bg: "bg-amber-50", stroke: "text-amber-700" },
  { bg: "bg-red-50", stroke: "text-red-700" },
];

function getIconColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "awaiting", label: "Awaiting" },
  { key: "failed", label: "Failed" },
];

function MetaDot() {
  return <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  const fetchAssessments = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    try {
      const params: {
        status?: string;
        role_title?: string;
        per_page: number;
      } = { per_page: 20 };
      if (filter !== "all") params.status = filter;
      if (debouncedSearch.trim()) params.role_title = debouncedSearch.trim();
      const res = await assessmentsApi.list(page, params, controller.signal);
      setAssessments(res.data.assessments);
      setTotalCount(res.data.meta.total_count);
      setTotalPages(res.data.meta.total_pages);
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED") return;
      setError(true);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, [filter, debouncedSearch, page]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleFilterChange = (f: FilterStatus) => {
    setFilter(f);
    setPage(1);
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
  };

  const hasActiveFilters = filter !== "all" || debouncedSearch.trim() !== "";

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setFilter("all");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Assessments</h1>
          {loading ? (
            <p className="text-sm text-muted-foreground mt-0.5">0 assessments</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount} assessment{totalCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New assessment
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertContent>Failed to load assessments. Please refresh the page.</AlertContent>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-xs order-2 sm:order-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by role title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap order-1 sm:order-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === f.key
                  ? "bg-teal-50 text-teal-700 border-teal-200"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={<Search className="h-6 w-6 text-muted-foreground" />}
            title="No matching assessments"
            description="No assessments match your current search or filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear search & filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6 text-muted-foreground" />}
            title="No assessments yet"
            description="Create an assessment to define skills and invite candidates."
            action={
              <Button variant="outline" onClick={() => navigate("/assessments/new")}>
                <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          {assessments.map((a) => {
            const { bg, stroke } = getIconColor(a.name);
            const ds = getDisplayStatus(a);
            const statusCfg = STATUS_BADGE[ds];

            return (
              <div
                key={a.id}
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
                className="flex items-center gap-3.5 bg-white border border-gray-200 rounded-xl px-4 py-3.5 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    bg
                  )}
                >
                  <ClipboardList className={cn("w-5 h-5", stroke)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {a.name}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      {a.time_limit_min} min
                    </span>
                    <MetaDot />
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                        {a.skills_count ?? 0} skill{(a.skills_count ?? 0) !== 1 ? "s" : ""}
                      </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      statusCfg.badge
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {statusCfg.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && assessments.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={cn(
                "h-8 w-8 rounded-md text-sm font-medium border transition-colors",
                p === page
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {p}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
