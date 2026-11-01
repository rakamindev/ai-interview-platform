import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { assessmentsApi } from "@/services/assessments";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import {
  Plus,
  Clock,
  ChevronRight,
  Search,
  Sparkles,
  Users,
  Layers,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground font-medium">
      No sessions yet
    </span>
  );

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
        Failed
      </span>
    );

  if (session.status === "ended")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300">
        Completed
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
      Awaiting candidate
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended">("all");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "active") return a.latest_session?.status === "active";
      if (statusFilter === "ended") return a.latest_session?.status === "ended";
      return true;
    });
  }, [assessments, searchQuery, statusFilter]);

  const activeCount = assessments.filter((a) => a.latest_session?.status === "active").length;
  const completedCount = assessments.filter((a) => a.latest_session?.status === "ended").length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header & UU PDP Compliance Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Assessments</h1>
            <PrivacyBadge />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Standardized AI-orchestrated competency assessments compliant with UU PDP No. 27/2022
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} className="shadow-xs">
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card/60 backdrop-blur-xs p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Templates</span>
            <Layers className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{assessments.length}</div>
        </div>

        <div className="rounded-xl border bg-card/60 backdrop-blur-xs p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium">Live Interviews</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            {activeCount}
          </div>
        </div>

        <div className="rounded-xl border bg-card/60 backdrop-blur-xs p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Evaluations Finished</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{completedCount}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex gap-1.5 bg-muted/60 p-1 rounded-lg self-start sm:self-auto border">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              statusFilter === "all"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({assessments.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              statusFilter === "active"
                ? "bg-background text-emerald-600 shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Live ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("ended")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              statusFilter === "ended"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/10 rounded-xl p-4 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load assessments from API. Please verify the backend connection.</span>
        </div>
      )}

      {/* Main List / Skeletons / Empty State */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-12 text-center space-y-3 bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <FolderOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">
              {searchQuery ? "No matching assessments found" : "No assessments created yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? "Try adjusting your search criteria or resetting the status filters."
                : "Configure your initial assessment template to generate unique candidate links and evaluate competencies."}
            </p>
          </div>
          {searchQuery ? (
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Your First Assessment
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAssessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer group hover:border-primary/50 hover:shadow-xs transition-all border-border/70"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {a.name}
                    </h2>
                    <SessionSummary session={a.latest_session} />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      {a.time_limit_min}m limit
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {a.skills?.length ?? 0} skills configured
                    </span>
                    {a.language && (
                      <>
                        <span>·</span>
                        <span className="uppercase text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted">
                          {a.language}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground group-hover:text-primary">
                    Manage
                    <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
