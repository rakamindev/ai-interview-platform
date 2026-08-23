import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );

  if (session.status === "ended")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Completed
      </span>
    );

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
      Waiting candidate
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Assessments</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage AI interviews and evaluate candidates.</p>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="h-11 px-5 rounded-xl shadow-sm transition-all hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4 mr-2" /> New Assessment
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        /* Premium Empty State */
        <div className="flex flex-col items-center justify-center p-12 sm:p-20 border-2 border-dashed border-zinc-200 rounded-[2rem] bg-zinc-50/50 text-center transition-all hover:bg-zinc-50 hover:border-zinc-300">
          <div className="w-20 h-20 bg-white border border-zinc-100 rounded-2xl flex items-center justify-center shadow-sm mb-6 relative">
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-50 text-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <FolderOpen className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 mb-2">No assessments yet</h3>
          <p className="text-zinc-500 text-sm max-w-sm mb-8 leading-relaxed">
            Create your first AI interview assessment to start evaluating candidates automatically and accurately.
          </p>
          <Button
            onClick={() => navigate("/assessments/new")}
            className="h-12 px-6 rounded-xl shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create First Assessment
          </Button>
        </div>
      ) : (
        /* Premium List View */
        <div className="grid gap-3">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="group cursor-pointer rounded-2xl border-zinc-200/60 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-300 overflow-hidden"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="p-5 flex items-center justify-between bg-white group-hover:bg-zinc-50/50 transition-colors">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-semibold text-base text-zinc-900 mb-2 truncate">{a.name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-500 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      {a.time_limit_min} Minutes
                    </span>
                    {a.latest_session && (
                      <SessionSummary session={a.latest_session} />
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-100 group-hover:bg-white group-hover:shadow-sm transition-all shrink-0">
                  <ChevronRight className="h-5 w-5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
