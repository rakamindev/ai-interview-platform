import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Search, Filter, MoreHorizontal, Calendar, ClipboardList } from "lucide-react";
import type { Assessment } from "@/types";
import { cn } from "@/lib/utils";

function StatusBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
        Draft
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />
        In progress
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
        Expired / Error
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        Completed
      </span>
    );
  }

  // Pending
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
      Awaiting candidate
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const getStatusCategory = (session?: Assessment["latest_session"]) => {
    if (!session) return "draft";
    if (session.status === "active") return "active";
    if (session.status === "ended" && session.end_reason === "error") return "error";
    if (session.status === "ended") return "completed";
    return "pending";
  };

  const filteredAssessments = assessments.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const statusCat = getStatusCategory(a.latest_session);
    const matchesStatus = statusFilter === "all" || statusCat === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track candidate assessments.</p>
        </div>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-2" /> New Assessment
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search assessments..." 
            className="pl-9 bg-card"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-card">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Awaiting</SelectItem>
              <SelectItem value="active">In Progress</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground bg-card">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-3 text-base font-medium text-foreground">No assessments yet</p>
          <p className="mb-6">Create your first assessment to start evaluating candidates.</p>
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-2" /> Create Assessment
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Assessment Title</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Created Date</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssessments.length > 0 ? (
                  filteredAssessments.map((a) => (
                    <tr 
                      key={a.id} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/assessments/${a.id}/invite`)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {a.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {a.id} • {a.language === "id" ? "Indonesian" : "English"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge session={a.latest_session} />
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {a.time_limit_min} min
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : "Just now"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assessments/${a.id}/edit`);
                        }}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No assessments match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
