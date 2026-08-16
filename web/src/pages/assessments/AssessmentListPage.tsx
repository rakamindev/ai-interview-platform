import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search, LayoutGrid, List, ChevronLeft, ChevronRight as ChevronNext } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment, PaginationMeta } from "@/types";

const VIEW_KEY = "assessments_view";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "awaiting", label: "Awaiting candidate" },
  { value: "live", label: "Live now" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;

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
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"card" | "list">(
    () => (localStorage.getItem(VIEW_KEY) as "card" | "list") || "card"
  );
  const navigate = useNavigate();

  // Debounce the search box; filter changes reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await assessmentsApi.list({
        page,
        per_page: 12,
        q: qDebounced || undefined,
        status: status === "all" ? undefined : (status as "awaiting" | "live" | "completed" | "failed"),
        language: language === "all" ? undefined : (language as "en" | "id"),
        sort: sort === "newest" ? undefined : (sort as "oldest" | "name"),
      });
      setAssessments(res.data.assessments);
      setMeta(res.data.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, qDebounced, status, language, sort]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const changeFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const toggleView = (v: "card" | "list") => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <button
              type="button"
              aria-label="Card view"
              onClick={() => toggleView("card")}
              className={cn("p-2", view === "card" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => toggleView("list")}
              className={cn("p-2", view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search assessments..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
        <Select value={status} onValueChange={changeFilter(setStatus)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={changeFilter(setLanguage)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="id">Bahasa Indonesia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={changeFilter(setSort)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">A–Z</SelectItem>
          </SelectContent>
        </Select>
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
          <p className="mb-3">
            {q || status !== "all" || language !== "all"
              ? "No assessments match your filters."
              : "No assessments yet."}
          </p>
          {!q && status === "all" && language === "all" && (
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          )}
        </div>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{a.name}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.time_limit_min} min
                  </span>
                  <span>{a.language === "id" ? "Bahasa Indonesia" : "English"}</span>
                </div>
                <SessionSummary session={a.latest_session} />
              </CardContent>
            </Card>
          ))}
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
                    <span>·</span>
                    <span>{a.language === "id" ? "Bahasa Indonesia" : "English"}</span>
                    <span>·</span>
                    <SessionSummary session={a.latest_session} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {meta.current_page} of {meta.total_pages} · {meta.total_count} items
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronNext className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
