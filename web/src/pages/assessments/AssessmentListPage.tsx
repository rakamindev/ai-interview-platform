import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { StatusCard } from "@/components/ui/status-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, RotateCcw, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Assessment, PaginationMeta } from "@/types";

function sessionTone(session: Assessment["latest_session"]): "primary" | "success" | "destructive" | "neutral" {
  if (!session) return "neutral";
  if (session.status === "active") return "primary";
  if (session.status === "ended" && session.end_reason === "error") return "destructive";
  if (session.status === "ended") return "success";
  return "neutral";
}

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
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    setLoading(true);
    assessmentsApi
      .list(page, tab === "archived", debouncedSearch || undefined)
      .then((res) => {
        setAssessments(res.data.assessments);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setError(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      setError(false);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debouncedSearch]);

  const handleRestore = async (a: Assessment) => {
    setRestoringId(a.id);
    try {
      await assessmentsApi.unarchive(a.id);
      setAssessments((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Assessment restored");
    } catch {
      toast.error("Failed to restore assessment.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search assessments..."
          className="pl-9 h-11 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            <p>No assessments match "{debouncedSearch}".</p>
          ) : tab === "archived" ? (
            <p>No archived assessments.</p>
          ) : (
            <>
              <p className="mb-3">No assessments yet.</p>
              <Button variant="outline" onClick={() => navigate("/assessments/new")}>
                <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const content = (
              <CardContent className="py-4 px-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{a.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_min} min
                    </span>
                    {tab === "active" && a.latest_session && (
                      <>
                        <span>·</span>
                        <SessionSummary session={a.latest_session} />
                      </>
                    )}
                  </div>
                </div>
                {tab === "archived" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restoringId === a.id}
                    onClick={() => handleRestore(a)}
                  >
                    {restoringId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Restore
                  </Button>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CardContent>
            );
            return (
              <StatusCard
                key={a.id}
                tone={tab === "active" ? sessionTone(a.latest_session) : "neutral"}
                className={tab === "active" ? "hover:shadow-md transition-shadow" : ""}
              >
                {tab === "active" ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/assessments/${a.id}/invite`)}
                    className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </StatusCard>
            );
          })}
          {meta && <Pagination meta={meta} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}
