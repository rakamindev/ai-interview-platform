import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControl } from "@/components/ui/pagination-control";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { sessionsApi } from "@/services/sessions";
import { assessmentsApi } from "@/services/assessments";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  Radio,
  Clock,
  AlertCircle,
  FileText,
  Copy,
  Check,
  Briefcase,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Send,
  Loader2,
  Plus,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session, Assessment } from "@/types";

function SearchableAssessmentPicker({
  assessments,
  value,
  onChange,
}: {
  assessments: Assessment[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const selected = assessments.find((a) => String(a.id) === value);
  const filtered = assessments.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase().trim())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs",
          open && "ring-2 ring-primary/20 border-primary bg-white"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
          {selected ? (
            <span className="truncate text-slate-900 font-semibold">
              {selected.name}{" "}
              <span className="text-slate-400 font-normal text-[11px]">({selected.time_limit_min} min)</span>
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Pilih Posisi Assessment...</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Search bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari nama assessment / lowongan..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* List options */}
          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                Tidak ada assessment yang cocok dengan "{query}"
              </div>
            ) : (
              filtered.map((a) => {
                const isSelected = String(a.id) === value;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onChange(String(a.id));
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full px-2.5 py-2 text-xs rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold border border-primary/20"
                        : "text-slate-700 hover:bg-slate-50 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{a.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-normal shrink-0">
                        {a.time_limit_min}m
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single Candidate Row / Card ──────────────────────────────────────────
function CandidateCard({
  session,
  copiedId,
  onCopy,
  formatDate,
}: {
  session: Session;
  copiedId: number | null;
  onCopy: (s: Session) => void;
  formatDate: (iso?: string) => string;
}) {
  const isCompleted = session.status === "ended" && session.end_reason !== "error";
  const isFailed = session.status === "ended" && session.end_reason === "error";
  const isLive = session.status === "active";
  const isPending = session.status === "pending";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3.5 group">
      {/* Left: Avatar & Candidate Info */}
      <div className="flex items-start sm:items-center gap-3">
        <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center font-bold text-sm sm:text-base border border-primary/20 shrink-0 shadow-2xs">
          {(session.candidate_name || "K").slice(0, 1).toUpperCase()}
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {session.candidate_name || "Kandidat Terdaftar"}
            </h3>

            {/* Status Badges */}
            {isCompleted && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-50 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Completed</span>
              </Badge>
            )}

            {isLive && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200/80 hover:bg-blue-50 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>Live Now</span>
              </Badge>
            )}

            {isPending && (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-50 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-600" />
                <span>Awaiting Start</span>
              </Badge>
            )}

            {isFailed && (
              <Badge className="bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-50 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-rose-600" />
                <span>Failed / Disconnected</span>
              </Badge>
            )}
          </div>

          {/* Sub metadata */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1 text-slate-700 font-medium truncate max-w-[180px] sm:max-w-none">
              <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="truncate">{session.assessment_name || "Assessment"}</span>
            </span>

            <span>•</span>

            <span className="flex items-center gap-1 text-slate-500 shrink-0">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>{formatDate(session.started_at || session.created_at)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions CTA */}
      <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0 w-full md:w-auto">
        {isCompleted && (
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 px-3 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 justify-center"
            >
              <Link to={`/assessments/${session.assessment_id}/sessions/${session.id}/transcript`}>
                <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                <span>Transcript</span>
              </Link>
            </Button>

            <Button
              asChild
              size="sm"
              className="h-8 sm:h-9 px-3.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs justify-center"
            >
              <Link to={`/assessments/${session.assessment_id}/sessions/${session.id}/portfolio`}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                <span>View Portfolio</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1 hidden xs:inline" />
              </Link>
            </Button>
          </div>
        )}

        {isLive && (
          <Button
            asChild
            size="sm"
            className="w-full md:w-auto h-8 sm:h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs justify-center"
          >
            <Link to={`/assessments/${session.assessment_id}/sessions/${session.id}/monitor`}>
              <Radio className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
              <span>Live Monitor</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        )}

        {isPending && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(session)}
            className="w-full md:w-auto h-8 sm:h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 justify-center"
          >
            {copiedId === session.id ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                <span>Copy Invite Link</span>
              </>
            )}
          </Button>
        )}

        {isFailed && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full md:w-auto h-8 sm:h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 justify-center"
          >
            <Link to={`/assessments/${session.assessment_id}/sessions/${session.id}/transcript`}>
              <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <span>View Transcript</span>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CandidateListPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assessmentFilter, setAssessmentFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Quick Invite / Test Dialog State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [createdSession, setCreatedSession] = useState<{ id: number; invite_url: string; candidate_name: string; assessment_name?: string } | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

  // Mobile Infinite Scroll State (Default 20 items per hit)
  const [mobileLimit, setMobileLimit] = useState(20);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([sessionsApi.listAll(), assessmentsApi.list()])
      .then(([sessionsRes, assessmentsRes]) => {
        setSessions(sessionsRes.data.sessions);
        setAssessments(assessmentsRes.data.assessments);
        if (assessmentsRes.data.assessments.length > 0) {
          setSelectedAssessmentId(String(assessmentsRes.data.assessments[0].id));
        }
      })
      .catch((err) => {
        console.error("Failed to load candidates:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = (session: Session) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateSession = async () => {
    if (!selectedAssessmentId || !candidateNameInput.trim()) return;
    setCreatingSession(true);
    try {
      const res = await assessmentsApi.createSession(
        Number(selectedAssessmentId),
        candidateNameInput.trim()
      );
      const newSessionData = res.data.session;
      const targetAssessment = assessments.find((a) => a.id === Number(selectedAssessmentId));
      setCreatedSession({
        id: newSessionData.id,
        invite_url: newSessionData.invite_url || res.data.invite_url,
        candidate_name: candidateNameInput.trim(),
        assessment_name: targetAssessment?.name,
      });
      // Refresh global candidate list
      const sessionsRes = await sessionsApi.listAll();
      setSessions(sessionsRes.data.sessions);
    } catch (err) {
      console.error("Failed to create candidate session:", err);
      alert("Gagal membuat sesi wawancara. Silakan coba lagi.");
    } finally {
      setCreatingSession(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => s.status === "ended" && s.end_reason !== "error").length;
    const live = sessions.filter((s) => s.status === "active").length;
    const awaiting = sessions.filter((s) => s.status === "pending").length;
    return { total, completed, live, awaiting };
  }, [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Search by candidate name or assessment name
      const candidateName = session.candidate_name?.toLowerCase() ?? "";
      const assessmentName = session.assessment_name?.toLowerCase() ?? "";
      const query = search.toLowerCase().trim();
      const matchesSearch = query === "" || candidateName.includes(query) || assessmentName.includes(query);

      // Status filter
      let matchesStatus = true;
      if (statusFilter === "completed") {
        matchesStatus = session.status === "ended" && session.end_reason !== "error";
      } else if (statusFilter === "live") {
        matchesStatus = session.status === "active";
      } else if (statusFilter === "awaiting") {
        matchesStatus = session.status === "pending";
      } else if (statusFilter === "failed") {
        matchesStatus = session.status === "ended" && session.end_reason === "error";
      }

      // Assessment filter
      let matchesAssessment = true;
      if (assessmentFilter !== "all") {
        matchesAssessment = String(session.assessment_id) === assessmentFilter;
      }

      return matchesSearch && matchesStatus && matchesAssessment;
    });
  }, [sessions, search, statusFilter, assessmentFilter]);

  // Reset pagination & infinite scroll on filter change
  const [desktopPage, setDesktopPage] = useState(1);
  const desktopPageSize = 8;

  useEffect(() => {
    setDesktopPage(1);
    setMobileLimit(20);
  }, [search, statusFilter, assessmentFilter]);

  // Desktop slice
  const desktopTotalPages = Math.ceil(filteredSessions.length / desktopPageSize);
  const desktopSessions = useMemo(() => {
    return filteredSessions.slice((desktopPage - 1) * desktopPageSize, desktopPage * desktopPageSize);
  }, [filteredSessions, desktopPage, desktopPageSize]);

  // Mobile slice (Infinite scroll: 20 per batch)
  const mobileSessions = useMemo(() => {
    return filteredSessions.slice(0, mobileLimit);
  }, [filteredSessions, mobileLimit]);

  // Mobile IntersectionObserver for Infinite Scroll
  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && mobileLimit < filteredSessions.length) {
          setTimeout(() => {
            setMobileLimit((prev) => prev + 20);
          }, 200);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mobileLimit, filteredSessions.length]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const openNewModal = () => {
    setCreatedSession(null);
    setCandidateNameInput("");
    if (assessments.length > 0) {
      setSelectedAssessmentId(String(assessments[0].id));
    }
    setInviteModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-28 sm:pb-8">
      {/* ── Page Header (Clean, Category badge + Title + Description + Action) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-0.5 text-[11px] inline-flex items-center gap-1.5 w-fit rounded-lg">
            <Users className="h-3 w-3 text-primary" />
            <span>Global Evaluation Pool</span>
          </Badge>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Candidates &amp; Results
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Pantau seluruh sesi wawancara kandidat, live monitoring, dan laporan portofolio di semua lowongan
          </p>
        </div>

        {/* Top Header Action Button */}
        <Button
          onClick={openNewModal}
          className="w-full sm:w-auto h-11 sm:h-10 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Undang / Test Kandidat</span>
        </Button>
      </div>

      {/* ── Metric Summary Cards (2x2 on Mobile, 4 Cols on Desktop) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Card className="rounded-2xl border-slate-200/80 shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{loading ? "..." : stats.total}</p>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-0.5">{loading ? "..." : stats.completed}</p>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Now</p>
              <p className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-0.5">{loading ? "..." : stats.live}</p>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <Radio className={cn("h-4 w-4 sm:h-5 sm:w-5", stats.live > 0 && "animate-pulse")} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting</p>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-0.5">{loading ? "..." : stats.awaiting}</p>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters & Search Bar (Clean and consistent) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari nama kandidat atau posisi assessment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 sm:h-10 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white text-xs sm:text-sm"
            />
          </div>

          {/* Assessment Filter Dropdown */}
          <SearchableSelect
            options={assessments.map((a) => ({
              value: String(a.id),
              label: a.name,
              description: `${a.time_limit_min} mins • ${a.skills?.length || 0} skills`,
            }))}
            value={assessmentFilter}
            onChange={setAssessmentFilter}
            placeholder="Semua Posisi Lowongan"
            allLabel="Semua Posisi Lowongan"
            className="w-full md:w-64"
            icon={<Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />}
            hideAllOption={false}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100 scrollbar-hide">
          {[
            { id: "all", label: "All", count: sessions.length },
            { id: "completed", label: "Completed", count: stats.completed },
            { id: "live", label: "Live Now", count: stats.live },
            { id: "awaiting", label: "Awaiting", count: stats.awaiting },
            { id: "failed", label: "Failed", count: sessions.filter((s) => s.status === "ended" && s.end_reason === "error").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                statusFilter === tab.id
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-md text-[10px]",
                  statusFilter === tab.id
                    ? "bg-slate-800 text-slate-200"
                    : "bg-white text-slate-500 border border-slate-200/60"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Candidates Content ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900">Tidak ada kandidat ditemukan</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {search || statusFilter !== "all" || assessmentFilter !== "all"
                ? "Coba ubah kata kunci pencarian atau filter yang Anda pilih."
                : "Belum ada sesi wawancara kandidat yang dibuat pada assessment apa pun."}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl text-xs font-semibold">
            <Link to="/assessments">Buka Menu Assessments</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── Desktop View (Paginated with Desktop Pagination Control) ── */}
          <div className="hidden md:block space-y-2.5">
            {desktopSessions.map((session) => (
              <CandidateCard
                key={session.id}
                session={session}
                copiedId={copiedId}
                onCopy={handleCopyLink}
                formatDate={formatDate}
              />
            ))}

            <PaginationControl
              currentPage={desktopPage}
              totalPages={desktopTotalPages}
              totalItems={filteredSessions.length}
              pageSize={desktopPageSize}
              onPageChange={setDesktopPage}
              className="pt-4"
            />
          </div>

          {/* ── Mobile View (Adaptive Infinite Scroll: Initial 20, loads 20 more on scroll) ── */}
          <div className="md:hidden space-y-2.5">
            {mobileSessions.map((session) => (
              <CandidateCard
                key={session.id}
                session={session}
                copiedId={copiedId}
                onCopy={handleCopyLink}
                formatDate={formatDate}
              />
            ))}

            {/* Infinite Scroll Sentinel */}
            {mobileLimit < filteredSessions.length && (
              <div
                ref={mobileSentinelRef}
                className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Memuat kandidat selanjutnya...</span>
              </div>
            )}

            {filteredSessions.length > 0 && mobileLimit >= filteredSessions.length && (
              <p className="py-3 text-center text-[11px] text-muted-foreground border-t border-slate-100">
                Semua {filteredSessions.length} kandidat telah ditampilkan
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile FAB (Floating Action Button identical to Assessments page) ── */}
      <button
        onClick={openNewModal}
        className="fixed bottom-20 right-4 sm:hidden z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 active:scale-95 transition-all duration-150 cursor-pointer"
        aria-label="Undang / Test Kandidat"
        title="Undang / Test Kandidat"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* ── Quick Invite / Test Dialog (Mobile-Safe Centered / Adaptive Modal) ── */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white rounded-3xl p-5 sm:p-6 mx-auto shadow-2xl overflow-hidden">
          {!createdSession ? (
            <div className="space-y-4 min-w-0">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      Undang / Test Kandidat
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Buat tautan sesi wawancara untuk kandidat atau uji coba.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3.5 py-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-900">
                    Pilih Posisi / Assessment <span className="text-rose-500">*</span>
                  </Label>
                  <SearchableAssessmentPicker
                    assessments={assessments}
                    value={selectedAssessmentId}
                    onChange={setSelectedAssessmentId}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-900">
                    Nama Kandidat / Pengetes <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="misal: Vika Ariyanti atau Test Runner"
                    value={candidateNameInput}
                    onChange={(e) => setCandidateNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && candidateNameInput.trim()) {
                        handleCreateSession();
                      }
                    }}
                    className="text-xs sm:text-sm h-11 rounded-2xl border-slate-200"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Nama ini akan digunakan sistem untuk menyapa kandidat selama sesi.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateSession}
                  disabled={!selectedAssessmentId || !candidateNameInput.trim() || creatingSession}
                  className="rounded-2xl text-xs sm:text-sm h-11 font-bold bg-primary hover:bg-primary/90 text-white shadow-xs cursor-pointer w-full flex items-center justify-center gap-1.5"
                >
                  {creatingSession ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Membuat Link...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Buat Link Wawancara →</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-2xl text-xs sm:text-sm h-10 font-semibold border-slate-200 w-full"
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 min-w-0">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      Tautan Wawancara Siap!
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Sesi untuk <span className="font-semibold text-slate-900">{createdSession.candidate_name}</span> telah aktif.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5 overflow-hidden">
                <div className="text-[11px] font-medium text-slate-600">
                  URL Undangan Sesi:
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={createdSession.invite_url}
                    className="text-xs bg-white px-3 py-2 rounded-xl border border-slate-200 text-slate-800 flex-1 min-w-0 truncate font-mono select-all focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(createdSession.invite_url);
                      setModalCopied(true);
                      setTimeout(() => setModalCopied(false), 2000);
                    }}
                    className="h-9 px-3 rounded-xl text-xs font-semibold shrink-0 border-slate-200 bg-white hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    {modalCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-600 mr-1" />
                        <span>Salin</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  asChild
                  size="sm"
                  className="rounded-2xl text-xs sm:text-sm h-11 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center justify-center gap-1.5 w-full"
                >
                  <a
                    href={createdSession.invite_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Mulai Test Wawancara Sekarang ↗</span>
                  </a>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreatedSession(null);
                    setCandidateNameInput("");
                    setInviteModalOpen(false);
                  }}
                  className="rounded-2xl text-xs sm:text-sm h-10 font-semibold border-slate-200 w-full cursor-pointer"
                >
                  Selesai
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
