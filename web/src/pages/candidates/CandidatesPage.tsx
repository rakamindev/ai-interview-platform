import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { PaginationControl } from "@/components/common/PaginationControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { sessionsApi } from "@/services/sessions";
import { useToast } from "@/hooks/useToast";
import {
  Users,
  Search,
  Copy,
  Check,
  Eye,
  Scale,
} from "lucide-react";
import type { Session, PaginationMeta } from "@/types";

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, success } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const currentStatus = searchParams.get("status") || "all";
  const currentPage = Number(searchParams.get("page")) || 1;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await sessionsApi.all({
        page: currentPage,
        status: currentStatus === "all" ? undefined : currentStatus,
        search: searchInput.trim() || undefined,
      });
      setSessions(res.data.sessions);
      setMeta(res.data.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentStatus, searchInput]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStatusFilter = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (status === "all") next.delete("status");
    else next.set("status", status);
    next.set("page", "1");
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set("search", searchInput.trim());
    else next.delete("search");
    next.set("page", "1");
    setSearchParams(next);
  };

  const handlePageChange = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  };

  const handleCopyLink = (session: Session) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(session.id);
    success("Copied to clipboard", "Candidate invite link is ready to share.");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleSelectCandidate = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCompareSelected = () => {
    if (selectedIds.length < 2) {
      toast({
        title: "Select at least 2 candidates",
        description: "Choose 2 or more completed candidate sessions to compare.",
        type: "error",
      });
      return;
    }
    navigate(`/candidates/compare?session_ids=${selectedIds.join(",")}`);
  };

  const statusTabs = [
    { key: "all", label: "All Candidates" },
    { key: "active", label: "Live Now" },
    { key: "needs_review", label: "Needs Review" },
    { key: "ended", label: "Completed" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Unified view of all candidate interview sessions across all role assessments."
        actions={
          selectedIds.length >= 2 && (
            <Button size="sm" onClick={handleCompareSelected} className="gap-1.5">
              <Scale className="h-4 w-4" />
              Compare ({selectedIds.length}) Selected
            </Button>
          )
        }
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-muted/60 rounded-xl border max-w-full">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                currentStatus === tab.key
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto md:max-w-xs">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search candidate or role..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-9 shrink-0">
            Search
          </Button>
        </form>
      </div>

      {/* Candidates Table */}
      {loading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <ErrorState onRetry={fetchSessions} title="Failed to load candidates" />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates found"
          description={
            searchInput || currentStatus !== "all"
              ? "Try adjusting your search query or status filter."
              : "Generate an assessment and invite your first candidate."
          }
          actionLabel={
            searchInput || currentStatus !== "all" ? "Reset Filters" : "Create Assessment"
          }
          onAction={() => {
            if (searchInput || currentStatus !== "all") {
              setSearchInput("");
              setSearchParams({});
            } else {
              navigate("/assessments/new");
            }
          }}
        />
      ) : (
        <Card className="shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === sessions.length && sessions.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(sessions.map((s) => s.id));
                          else setSelectedIds([]);
                        }}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Role Assessment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map((s) => {
                    const isSelected = selectedIds.includes(s.id);
                    const isLive = s.status === "active";
                    const isEnded = s.status === "ended";
                    const isPending = s.status === "pending";

                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCandidate(s.id)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">
                            {s.candidate_name || `Candidate #${s.id}`}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {s.id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground">
                            {s.assessment_name || "—"}
                          </span>
                          {s.time_limit_min && (
                            <span className="text-muted-foreground text-[10px] block">
                              {s.time_limit_min} min session
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isLive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold text-[10px] border border-primary/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                              Live Now
                            </span>
                          )}
                          {isEnded && s.portfolio_status === "complete" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold text-[10px] border border-teal-500/20">
                              Portfolio Ready
                            </span>
                          )}
                          {isEnded && s.portfolio_status !== "complete" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-semibold text-[10px]">
                              Completed
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px] border border-amber-500/20">
                              Awaiting Candidate
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {s.started_at
                            ? new Date(s.started_at).toLocaleDateString()
                            : s.created_at
                            ? new Date(s.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleCopyLink(s)}
                              >
                                {copiedId === s.id ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1 text-green-600" /> Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 mr-1" /> Copy Link
                                  </>
                                )}
                              </Button>
                            )}
                            {isLive && (
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs gap-1"
                                onClick={() =>
                                  navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/monitor`)
                                }
                              >
                                <Eye className="h-3 w-3" /> Monitor
                              </Button>
                            )}
                            {isEnded && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs"
                                onClick={() =>
                                  navigate(`/assessments/${s.assessment_id}/sessions/${s.id}/portfolio`)
                                }
                              >
                                View Results
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="p-3 border-t">
              <PaginationControl meta={meta} onPageChange={handlePageChange} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

