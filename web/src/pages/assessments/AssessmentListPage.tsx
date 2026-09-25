import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  Briefcase,
  Search,
  Globe,
  Radio,
  CheckCircle2,
  AlertCircle,
  Hourglass,
} from "lucide-react";
import type { Assessment } from "@/types";

function SessionStatusBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        <Hourglass className="h-3 w-3 text-muted-foreground/70" />
        Awaiting candidate
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        Live now
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
        <AlertCircle className="h-3 w-3" />
        Session failed
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      <Radio className="h-3 w-3 opacity-60" />
      Pending
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = assessments.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = a.name.toLowerCase().includes(q);
    const vacancyMatch = a.vacancy?.role_title?.toLowerCase().includes(q);
    return nameMatch || vacancyMatch;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Assessments</h1>
            {!loading && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {assessments.length} total
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your AI interview templates, vacancy connections, and candidate sessions.
          </p>
        </div>

        <Button
          onClick={() => navigate("/assessments/new")}
          className="shadow-sm font-medium self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {/* Filter / Search Bar */}
      {assessments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assessments by role or linked vacancy..."
            className="pl-9 h-10 bg-background"
          />
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-xl p-4 text-sm text-destructive font-medium">
          Failed to load assessments. Please refresh the page or verify the API service.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-muted/20 space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Briefcase className="h-6 w-6" />
          </div>
          <p className="font-semibold text-base text-foreground">No assessments created yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Get started by creating your first AI-driven assessment linked directly to a vacancy.
          </p>
          <div className="pt-2">
            <Button onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          </div>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
          No assessments match your search "{searchQuery}".
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssessments.map((a) => (
            <Card
              key={a.id}
              className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 border-border/80"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                      {a.name}
                    </p>

                    {/* Vacancy Badge (Vacancy-Centric UI) */}
                    {a.vacancy ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#01959F]/10 dark:bg-[#01959F]/20 text-[#01959F] dark:text-teal-300 border border-[#01959F]/25 dark:border-[#01959F]/35">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[200px]">{a.vacancy.role_title}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-normal text-muted-foreground bg-muted">
                        Standalone
                      </span>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {a.time_limit_min} min
                    </span>

                    <span>·</span>

                    <span className="inline-flex items-center gap-1 uppercase tracking-wide font-medium">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {a.language || "en"}
                    </span>

                    <span>·</span>

                    <SessionStatusBadge session={a.latest_session} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <span className="text-xs font-medium hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                    View Sessions
                  </span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
