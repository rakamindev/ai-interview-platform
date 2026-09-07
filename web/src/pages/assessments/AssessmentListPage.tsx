import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search, ClipboardList, Radio, CheckCircle2, UserCheck, Globe } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
        Live Interview in Progress
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        Session Error
      </span>
    );

  if (session.status === "ended")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Last Completed
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      Awaiting Candidate
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
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

  const stats = useMemo(() => {
    const total = assessments.length;
    const activeCount = assessments.filter((a) => a.latest_session?.status === "active").length;
    const completedCount = assessments.filter((a) => a.latest_session?.status === "ended").length;
    return { total, activeCount, completedCount };
  }, [assessments]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Assessments & Candidate Monitoring</h1>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 text-xs font-medium shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Assessment
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Blueprints</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Live Interviews</p>
              <p className="text-xl font-bold text-slate-900">
                {stats.activeCount} <span className="text-xs font-normal text-slate-500">ongoing</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Evaluations Finished</p>
              <p className="text-xl font-bold text-slate-900">
                {stats.completedCount} <span className="text-xs font-normal text-slate-500">sessions</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search assessment blueprints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white border-slate-200"
          />
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-red-50/50 rounded-lg p-4 text-xs text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-slate-200 bg-white rounded-lg p-12 text-center text-sm text-muted-foreground">
          <ClipboardList className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-slate-900">
            {search ? "No matching assessments found." : "No assessment rubrics configured yet."}
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Create an assessment blueprint to start inviting candidates for conversational AI technical evaluations.
          </p>
          <Button
            onClick={() => navigate("/assessments/new")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Assessment Blueprint
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAssessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer border border-slate-200 shadow-none hover:border-slate-300 hover:shadow-sm transition-all bg-white"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-semibold text-sm text-slate-900">{a.name}</p>
                    <SessionSummary session={a.latest_session} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {a.time_limit_min} minutes
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 uppercase">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      {a.language ? a.language.toUpperCase() : "EN"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-medium text-slate-600">
                  <span>Manage Candidates</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
