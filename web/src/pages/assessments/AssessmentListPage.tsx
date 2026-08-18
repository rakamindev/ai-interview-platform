import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search, Sparkles, Activity, CheckCircle2 } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="text-xs text-muted-foreground">No sessions created</span>;

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300">
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
        Live Now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs font-medium text-destructive">Last: Failed</span>;

  if (session.status === "ended")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-teal-600" /> Last: Completed
      </span>
    );

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = useMemo(() => {
    if (!search.trim()) return assessments;
    return assessments.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [assessments, search]);

  const activeSessionsCount = useMemo(
    () => assessments.filter((a) => a.latest_session?.status === "active").length,
    [assessments]
  );

  return (
    <div className="space-y-6 w-full">

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage interview blueprints and candidate evaluation sessions.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} className="shadow-xs font-medium">
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {/* Overview Metric Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border rounded-xl p-4 bg-card shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Blueprints</p>
            <p className="text-xl font-bold">{loading ? "..." : assessments.length}</p>
          </div>
        </div>

        <div className="border rounded-xl p-4 bg-card shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active Live Sessions</p>
            <p className="text-xl font-bold">{loading ? "..." : activeSessionsCount}</p>
          </div>
        </div>

        <div className="border rounded-xl p-4 bg-card shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-secondary/30 text-secondary-foreground flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Default Duration</p>
            <p className="text-xl font-bold">45 min</p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      {assessments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assessments by role name..."
            className="pl-9 bg-card shadow-2xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive font-medium">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-sm text-muted-foreground bg-card shadow-2xs">
          <p className="font-semibold text-base text-foreground mb-1">
            {search ? "No matching assessments found" : "No assessments created yet"}
          </p>
          <p className="mb-4 text-xs">
            {search ? "Try clearing your search query." : "Create your first assessment blueprint to invite candidates."}
          </p>
          <Button variant="outline" onClick={() => (search ? setSearch("") : navigate("/assessments/new"))}>
            {search ? "Clear Search" : <><Plus className="h-4 w-4 mr-1.5" /> Create Assessment</>}
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAssessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-teal-500/50 hover:shadow-xs transition-all border-border/80"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-4 px-5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base text-foreground">{a.name}</p>
                    <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded bg-muted font-mono font-medium text-muted-foreground">
                      {a.language || "EN"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5 text-teal-600" />
                      {a.time_limit_min} min limit
                    </span>
                    <span>·</span>
                    <SessionSummary session={a.latest_session} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">Manage &amp; Invite</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
