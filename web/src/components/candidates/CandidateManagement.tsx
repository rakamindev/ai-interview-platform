import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { candidatesApi, type CandidateQuery } from "@/services/candidates";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Candidate, Session, Verdict } from "@/types";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Search,
  UserRound,
} from "lucide-react";

const INTERVIEW_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const VERDICT_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All verdicts" },
  { value: "pass", label: "Pass" },
  { value: "consider", label: "Consider" },
  { value: "failed", label: "Failed" },
];

const SORT_OPTIONS: { value: CandidateQuery["sort"]; label: string }[] = [
  { value: "interview_date", label: "Interview date" },
  { value: "name", label: "Candidate name" },
  { value: "interview_status", label: "Interview status" },
  { value: "verdict", label: "Verdict" },
];

const VERDICT_BADGE: Record<Verdict, string> = {
  pass: "bg-green-100 text-green-700",
  consider: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600",
  active: "bg-primary/10 text-primary",
  completed: "bg-green-50 text-green-600",
  failed: "bg-red-50 text-red-600",
};

interface CandidateManagementProps {
  assessmentId: number;
  sessions: Session[];
  onMonitor: (sessionId: number) => void;
  onResults: (sessionId: number) => void;
}

export default function CandidateManagement({
  assessmentId,
  sessions,
  onMonitor,
  onResults,
}: CandidateManagementProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [interviewStatus, setInterviewStatus] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [sort, setSort] = useState<CandidateQuery["sort"]>("interview_date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const sessionsById = useMemo(() => {
    const map = new Map<number, Session>();
    sessions.forEach((s) => map.set(s.id, s));
    return map;
  }, [sessions]);

  const hasActiveFilters = debouncedSearch !== "" || interviewStatus !== "all" || verdict !== "all";

  const fetchCandidates = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await candidatesApi.list(assessmentId, {
        search: debouncedSearch || undefined,
        interview_status: interviewStatus === "all" ? undefined : (interviewStatus as CandidateQuery["interview_status"]),
        verdict: verdict === "all" ? undefined : (verdict as CandidateQuery["verdict"]),
        sort,
        direction,
        page,
        per_page: 10,
      });
      setCandidates(res.data.candidates);
      setTotalCount(res.data.meta.total_count);
      setTotalPages(res.data.meta.total_pages);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, debouncedSearch, interviewStatus, verdict, sort, direction, page]);

  // Reset to page 1 and clear selection whenever filters change (not on page nav itself).
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, interviewStatus, verdict, sort, direction]);

  const toggleSort = (field: CandidateQuery["sort"]) => {
    if (sort === field) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setDirection("asc");
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.candidate_id))
    );
  };

  const copyLink = (candidateId: number) => {
    const session = sessionsById.get(candidateId);
    if (!session?.invite_url) return;
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(candidateId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const runExport = async (format: "transcript" | "json") => {
    setExporting(true);
    try {
      const res = await candidatesApi.export(assessmentId, format, Array.from(selectedIds));
      const blob = new Blob([JSON.stringify(res.data.results, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `candidates-${format}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search candidate name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Select value={interviewStatus} onValueChange={setInterviewStatus}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVIEW_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={verdict} onValueChange={setVerdict}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERDICT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => toggleSort(v as CandidateQuery["sort"])}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value!}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2.5"
          onClick={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
          title={direction === "asc" ? "Ascending" : "Descending"}
        >
          {direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={exporting}>
                  <Download className="h-3 w-3 mr-1.5" />
                  {exporting ? "Exporting..." : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => runExport("transcript")}>Transcript (JSON)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("json")}>Portfolio data (JSON)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">Loading candidates...</div>
      ) : error ? (
        <div className="border rounded-lg p-10 text-center space-y-3">
          <p className="text-sm font-medium">Couldn't load candidates</p>
          <Button size="sm" variant="outline" onClick={fetchCandidates}>
            Retry
          </Button>
        </div>
      ) : candidates.length === 0 ? (
        <div className="border rounded-lg p-10 text-center space-y-3">
          <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">{hasActiveFilters ? "No candidates match these filters" : "No candidates yet"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilters
                ? "Try clearing the search or filters."
                : 'Click "Invite Candidate" to generate an interview link.'}
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-input"
                checked={selectedIds.size === candidates.length}
                onChange={toggleSelectAll}
              />
              <span className="flex-1">Candidate</span>
              <span className="w-24 text-center">Status</span>
              <span className="w-20 text-center">Verdict</span>
              <span className="w-32 text-right">Actions</span>
            </div>
            <div className="divide-y">
              {candidates.map((c) => {
                const session = sessionsById.get(c.candidate_id);
                return (
                  <div key={c.candidate_id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-input"
                      checked={selectedIds.has(c.candidate_id)}
                      onChange={() => toggleSelect(c.candidate_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.candidate_name || `Candidate ${c.candidate_id}`}</div>
                      {c.interview_date && (
                        <div className="text-xs text-muted-foreground">{new Date(c.interview_date).toLocaleDateString()}</div>
                      )}
                    </div>
                    <span className={`w-24 text-center text-xs rounded-full px-2 py-0.5 ${STATUS_BADGE[c.interview_status] ?? ""}`}>
                      {c.interview_status}
                    </span>
                    <span className="w-20 text-center text-xs">
                      {c.verdict ? (
                        <span className={`rounded-full px-2 py-0.5 ${VERDICT_BADGE[c.verdict]}`}>{c.verdict}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <div className="w-32 flex justify-end gap-1.5">
                      {c.interview_status === "pending" && session?.invite_url && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => copyLink(c.candidate_id)}>
                          {copiedId === c.candidate_id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                      {c.session_status === "active" && (
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onMonitor(c.session_id)}>
                          <Eye className="h-3 w-3 mr-1" /> Monitor
                        </Button>
                      )}
                      {c.interview_status === "completed" && (
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onResults(c.session_id)}>
                          Results
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalCount} total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
