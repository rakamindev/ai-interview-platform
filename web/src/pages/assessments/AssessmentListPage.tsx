import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ClipboardList,
  Layers,
  Radio,
  Search,
  CheckCircle2,
  AlertCircle,
  Globe2,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { Assessment } from "@/types";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const },
  },
};

function SessionSummaryBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70 bg-neutral-100/70 border border-border/60 rounded-md px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        Ready to invite
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-md px-2 py-0.5 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Interview
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-0.5">
        <AlertCircle className="w-3 h-3 text-destructive" />
        Session failed
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3 text-primary" />
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70 bg-neutral-100/70 border border-border/60 rounded-md px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
      Awaiting candidate
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = useMemo(() => {
    if (!searchQuery.trim()) return assessments;
    const q = searchQuery.toLowerCase();
    return assessments.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.language && a.language.toLowerCase().includes(q))
    );
  }, [assessments, searchQuery]);

  // Metrics
  const activeCount = assessments.filter((a) => a.latest_session?.status === "active").length;
  const completedCount = assessments.filter((a) => a.latest_session?.status === "ended").length;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Assessments</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure interview rubrics, competency anchors, and manage candidate sessions.
          </p>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="active:scale-[0.98] transition-transform shadow-xs font-medium text-xs h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {/* Metrics strip */}
      {!loading && !error && assessments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-border/70 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <ClipboardList className="h-3.5 w-3.5 text-primary" />
              <span>Total Assessments</span>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-foreground">{assessments.length}</p>
          </div>

          <div className="p-3 rounded-xl border border-border/70 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span>Live Sessions</span>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-emerald-600">{activeCount}</p>
          </div>

          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-border/70 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Completed Sessions</span>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-foreground">{completedCount}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {!loading && assessments.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assessments..."
            className="pl-9 h-9 text-xs rounded-xl bg-white border-border/80 focus-visible:ring-primary/20"
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load assessments. Please refresh the page.</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-18 w-full rounded-xl" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        /* Empty state */
        <div className="border border-dashed border-border rounded-2xl p-12 text-center bg-white/50">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">No assessments created yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-5">
            Create your first competency-based assessment with custom questions and AI scoring rubrics.
          </p>
          <Button onClick={() => navigate("/assessments/new")} size="sm" className="rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        /* Assessment list */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2.5"
        >
          {filteredAssessments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No assessments matching "{searchQuery}"
            </p>
          ) : (
            filteredAssessments.map((a) => (
              <motion.div
                key={a.id}
                variants={itemVariants}
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
                className="group relative flex items-center justify-between p-4 rounded-xl border border-border/80 bg-white hover:border-primary/50 hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-[0.995]"
              >
                <div className="space-y-1.5 min-w-0 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {a.name}
                    </h3>
                    <SessionSummaryBadge session={a.latest_session} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      {a.time_limit_min} min
                    </span>

                    {a.skills && a.skills.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Layers className="h-3 w-3 text-muted-foreground/70" />
                        {a.skills.length} skills
                      </span>
                    )}

                    {a.language && (
                      <span className="inline-flex items-center gap-1 text-[11px] uppercase font-mono">
                        <Globe2 className="h-3 w-3 text-muted-foreground/70" />
                        {a.language}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}
