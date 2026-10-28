import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronDown,
  Search,
  ClipboardList,
  Users,
  Copy,
  Check,
  Briefcase,
} from "lucide-react";
import TablePagination from "@/components/common/TablePagination";
import type { Assessment, Session } from "@/types";

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<number, Session[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Record<number, boolean>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Track copied session ID for quick feedback
  const [copiedSessionId, setCopiedSessionId] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => {
        const list = res.data.assessments || [];
        setAssessments(list);

        // Preload sessions in background so card dropdown expansion is instant and smooth
        list.forEach((a) => {
          assessmentsApi
            .getSessions(a.id)
            .then((sRes) => {
              setExpandedSessions((prev) => ({ ...prev, [a.id]: sRes.data.sessions || [] }));
            })
            .catch(() => {});
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assessments;
    return assessments.filter((a) => a.name.toLowerCase().includes(q));
  }, [assessments, search]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Paginated assessments
  const paginatedAssessments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleToggleExpand = async (e: React.MouseEvent, assessmentId: number) => {
    e.stopPropagation();
    if (expandedId === assessmentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assessmentId);

    if (!expandedSessions[assessmentId]) {
      setLoadingSessions((prev) => ({ ...prev, [assessmentId]: true }));
      try {
        const res = await assessmentsApi.getSessions(assessmentId);
        setExpandedSessions((prev) => ({ ...prev, [assessmentId]: res.data.sessions || [] }));
      } catch {
        // ignore
      } finally {
        setLoadingSessions((prev) => ({ ...prev, [assessmentId]: false }));
      }
    }
  };

  const handleCopyLink = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const url = `${window.location.origin}/join/${session.invite_token}`;
    navigator.clipboard.writeText(url);
    setCopiedSessionId(session.id);
    setTimeout(() => setCopiedSessionId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessments</h1>
            <Badge variant="outline" className="text-slate-600 bg-slate-50">
              {assessments.length} Active
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage assessment configurations, invite candidates, and review interview results.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assessment by role title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {error && (
        <div className="border border-destructive/40 bg-rose-50 rounded-xl p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-sm text-muted-foreground bg-white">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-semibold text-slate-700">
            {search ? "No assessments found matching your search" : "No assessments created yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {search
              ? "Try adjusting your search terms."
              : "Get started by creating your first candidate assessment."}
          </p>
          {!search && (
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {paginatedAssessments.map((a) => {
              const isExpanded = expandedId === a.id;
              const sessions = expandedSessions[a.id] ?? [];
              const isLoadingDetails = loadingSessions[a.id];
              const candidateCount = a.sessions_count ?? sessions.length;

              return (
                <Card
                  key={a.id}
                  className="border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all duration-300 overflow-hidden bg-white"
                >
                  {/* Header Row — Clicking card toggles expand/collapse */}
                  <div
                    className="py-3.5 px-4 sm:px-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors duration-200 select-none"
                    onClick={(e) => handleToggleExpand(e, a.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {a.name}
                        </p>

                        {/* Subtitle: Time limit & Candidate Count */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {a.time_limit_min} minutes
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: View Details Toggle Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                        onClick={(e) => handleToggleExpand(e, a.id)}
                      >
                        <span className="mr-1 hidden sm:inline">
                          {isExpanded ? "Hide Details" : "View Details"}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 ease-in-out ${
                            isExpanded ? "rotate-180 text-primary" : "rotate-0 text-slate-400"
                          }`}
                        />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details Section — Silky smooth height + opacity transition */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                      isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden min-h-0">
                      <div
                        className={`px-4 sm:px-5 py-4 bg-slate-50/50 space-y-4 border-t border-slate-100 transition-opacity duration-300 ease-in-out ${
                          isExpanded ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        {/* Subheader */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            Candidate Sessions:
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {sessions.length} candidate{sessions.length !== 1 ? "s" : ""} registered
                          </span>
                        </div>

                        {/* Candidates Content */}
                        {isLoadingDetails ? (
                          <div className="space-y-2 py-1">
                            <Skeleton className="h-10 w-full rounded-lg" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 text-xs text-muted-foreground">
                            No candidates invited yet. Click "Open Assessment Details" below to invite candidates and configure sessions.
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-white divide-y divide-slate-100 shadow-2xs">
                            {sessions.slice(0, 5).map((s, idx) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="font-semibold text-xs text-slate-800 truncate">
                                    {s.candidate_name || `Candidate ${idx + 1}`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Status Badge */}
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      s.status === "active"
                                        ? "bg-primary/10 text-primary border-primary/20"
                                        : s.status === "ended"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    {s.status === "active"
                                      ? "Live"
                                      : s.status === "ended"
                                      ? "Completed"
                                      : "Scheduled"}
                                  </Badge>

                                  {/* Copy Link Button */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] border-slate-200 hover:border-primary/40 hover:text-primary"
                                    onClick={(e) => handleCopyLink(e, s)}
                                    title="Copy interview link"
                                  >
                                    {copiedSessionId === s.id ? (
                                      <span className="flex items-center text-emerald-600 font-medium">
                                        <Check className="h-3 w-3 mr-1" /> Copied
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Copy className="h-3 w-3 mr-1 text-slate-500" /> Copy Link
                                      </span>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}

                            {sessions.length > 5 && (
                              <div className="px-3 py-1.5 text-center text-muted-foreground text-[11px] bg-slate-50/50">
                                + {sessions.length - 5} more candidate
                                {sessions.length - 5 > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bottom Footer Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                          <Button
                            size="sm"
                            className="text-xs bg-primary text-white"
                            onClick={() => navigate(`/assessments/${a.id}/invite`)}
                          >
                            Open Assessment Details →
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
