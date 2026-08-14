import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { assessmentsApi } from "@/services/assessments";
import {
  Copy,
  Check,
  Radio,
  Plus,
  Users,
  Clock,
  Pencil,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  UserRound,
  Search,
  X,
  Filter
} from "lucide-react";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { Assessment, Session } from "@/types";

function StatusPill({ session }: { session: Session }) {
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";

  if (isLive)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Live Now
      </span>
    );
  if (isPending)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Awaiting Start
      </span>
    );
  if (isEnded && session.end_reason === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
      <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
      Completed
    </span>
  );
}

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* ── Desktop row ── */}
      <div className="hidden sm:flex items-center justify-between py-4 px-5 hover:bg-slate-50/80 transition-colors">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold shrink-0 border border-primary/20 shadow-xs">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
              {displayName}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {session.started_at
                ? `Started ${new Date(session.started_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                : "Invite link generated"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <StatusPill session={session} />
          <div className="flex items-center gap-2">
            {isPending && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs bg-white hover:bg-slate-50 shadow-xs cursor-pointer"
                onClick={() => onCopy(session.id)}
              >
                {copiedId === session.id ? (
                  <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Copy link</>
                )}
              </Button>
            )}
            {isLive && (
              <Button
                size="sm"
                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
              >
                <Radio className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> Monitor Live
              </Button>
            )}
            {isEnded && session.end_reason !== "error" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs bg-white hover:bg-slate-50 shadow-xs cursor-pointer"
                onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
              >
                View Results <ChevronRight className="h-3 w-3 ml-1 text-slate-400" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile card ── */}
      <div className="sm:hidden p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold shrink-0 border border-primary/20">
              {initials}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-sm text-slate-900 truncate block">
                {displayName}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {session.started_at
                  ? new Date(session.started_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : "Invite generated"}
              </span>
            </div>
          </div>
          <StatusPill session={session} />
        </div>

        <div className="pt-1">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 bg-white"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Link Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Copy Candidate Link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              size="sm"
              className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Radio className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> Monitor Live
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 bg-white"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              View Results <ChevronRight className="h-3.5 w-3.5 ml-1 text-slate-400" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Filters state
  const [searchCandidate, setSearchCandidate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "ended">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");

  // Invite modal state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setNewSession(null);
    setNewSessionCopied(false);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, sid: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(sid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  // Filter sessions by search, status, and Date Preset
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return sessions.filter((s) => {
      // 1. Search candidate name
      const nameMatch =
        !searchCandidate.trim() ||
        (s.candidate_name && s.candidate_name.toLowerCase().includes(searchCandidate.toLowerCase().trim()));
      if (!nameMatch) return false;

      // 2. Status filter
      if (statusFilter === "active" && s.status !== "active") return false;
      if (statusFilter === "pending" && s.status !== "pending") return false;
      if (statusFilter === "ended" && s.status !== "ended") return false;

      // 3. Date Preset filter
      if (dateFilter !== "all") {
        const sessionDate = s.started_at ? new Date(s.started_at) : s.created_at ? new Date(s.created_at) : null;
        if (sessionDate) {
          if (dateFilter === "today" && sessionDate < startOfToday) return false;
          if (dateFilter === "week" && sessionDate < startOfWeek) return false;
          if (dateFilter === "month" && sessionDate < startOfMonth) return false;
        }
      }

      return true;
    });
  }, [sessions, searchCandidate, statusFilter, dateFilter]);

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const completedCount = sessions.filter((s) => s.status === "ended" && s.end_reason !== "error").length;
  const pendingCount = sessions.filter((s) => s.status === "pending").length;

  const hasActiveFilters = Boolean(searchCandidate.trim()) || statusFilter !== "all" || dateFilter !== "all";

  const clearFilters = () => {
    setSearchCandidate("");
    setStatusFilter("all");
    setDateFilter("all");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-28 sm:pb-8">
      {/* ── Top Header Banner ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
              <Link to="/assessments" className="hover:text-foreground flex items-center gap-1 text-slate-500 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Assessments
              </Link>
              <span>/</span>
              <span className="text-slate-900 font-semibold">Detail &amp; Candidates</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {assessment?.name ?? "—"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 flex items-center gap-1 font-normal py-1">
                <Clock className="h-3 w-3 text-slate-500" />
                {assessment?.time_limit_min} Minutes
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 flex items-center gap-1 font-normal py-1">
                <Layers className="h-3 w-3 text-slate-500" />
                {assessment?.skills?.length ?? 0} Assessed Skills
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 flex items-center gap-1 font-normal py-1">
                <Users className="h-3 w-3 text-slate-500" />
                {sessions.length} Candidates
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="bg-white hover:bg-slate-50 shadow-xs h-9 cursor-pointer"
              onClick={() => navigate(`/assessments/${id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Edit Assessment
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white shadow-sm h-9 cursor-pointer font-semibold"
              onClick={openInviteDialog}
              disabled={creatingSession}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {creatingSession ? "Creating..." : "Invite Candidate"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Link Created Success Alert ── */}
      {newSession && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in-50 duration-200 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-sm font-bold text-emerald-900">
                Candidate Invite Link Ready!
              </p>
            </div>
            <p className="text-xs text-emerald-700">
              Share this link with <span className="font-semibold">{newSession.candidate_name || "the candidate"}</span> to start their interview session.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <code className="text-xs bg-white px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 truncate max-w-[200px] sm:max-w-xs font-mono">
              {newSession.invite_url}
            </code>
            <Button
              size="sm"
              onClick={copyNewSessionLink}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs cursor-pointer"
            >
              {newSessionCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Main 2-Column Dashboard Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ── Left Column: Candidate Sessions (2 cols on lg) ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200/80 shadow-xs overflow-hidden">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Candidates
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Real-time status and access to live monitor &amp; portfolio
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-semibold self-start sm:self-auto">
                {filteredSessions.length} / {sessions.length} candidate{sessions.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>

            {/* ── Candidate Filters Bar (Search + Date Preset + Status Tabs) ── */}
            <div className="p-3.5 border-b border-slate-100 bg-white flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                {/* Search candidate name */}
                <div className="relative flex-1 min-w-[160px] sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search candidate..."
                    value={searchCandidate}
                    onChange={(e) => setSearchCandidate(e.target.value)}
                    className="pl-8 h-8 text-xs bg-slate-50/50 border-slate-200"
                  />
                </div>

                {/* Date Preset Filter */}
                <div className="w-full sm:w-44">
                  <Select
                    value={dateFilter}
                    onValueChange={(val: any) => setDateFilter(val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-slate-50/50 border-slate-200">
                      <div className="flex items-center gap-1.5 truncate">
                        <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <SelectValue placeholder="Date" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Hari Ini (Today)</SelectItem>
                      <SelectItem value="week">7 Hari Terakhir</SelectItem>
                      <SelectItem value="month">Bulan Ini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Reset
                  </Button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg self-start sm:self-center">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Live" },
                  { id: "pending", label: "Awaiting" },
                  { id: "ended", label: "Completed" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                      statusFilter === tab.id
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <UserRound className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="max-w-sm mx-auto">
                    <p className="text-sm font-semibold text-slate-900">No candidates invited yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click the "Invite Candidate" button above to generate a unique interview link.
                    </p>
                  </div>
                  <Button size="sm" onClick={openInviteDialog} className="shadow-xs cursor-pointer">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite First Candidate
                  </Button>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Filter className="h-6 w-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-800">No candidates match current filter</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs h-7">
                    Reset Filter
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredSessions.map((session, i) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      index={sessions.length - i}
                      assessmentId={id!}
                      onCopy={(sid) => {
                        const s = sessions.find((x) => x.id === sid);
                        if (s) copyLink(s, sid);
                      }}
                      copiedId={copiedId}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Sidebar (1 col on lg) ── */}
        <div className="space-y-6">
          
          {/* Quick Stats Widget */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-3.5 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-900">
                Session Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="block text-xl font-bold text-amber-700">{pendingCount}</span>
                <span className="text-[11px] font-medium text-amber-800">Awaiting</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="block text-xl font-bold text-emerald-700">{activeCount}</span>
                <span className="text-[11px] font-medium text-emerald-800">Live Now</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200/80">
                <span className="block text-xl font-bold text-slate-700">{completedCount}</span>
                <span className="text-[11px] font-medium text-slate-600">Completed</span>
              </div>
            </CardContent>
          </Card>

          {/* Assessment Skills & Target Level Target Badges */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="py-3.5 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-900">
                Assessed Skills &amp; Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {assessment?.skills && assessment.skills.length > 0 ? (
                <div className="space-y-2.5">
                  {assessment.skills.map((skill, index) => {
                    const levelNum = skill.expected_level ?? 3;
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
                      >
                        <span className="font-semibold text-slate-800 truncate mr-2">
                          {skill.skill_label}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold px-2 py-0.5 shrink-0 bg-primary/10 text-primary border border-primary/20"
                        >
                          {LEVEL_LABELS[levelNum] ?? `L${levelNum}`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No skills defined for this assessment.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Invite Candidate Dialog Modal ── */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Invite Candidate
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter the candidate's name to generate an automated AI interview link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidateName" className="text-xs font-semibold text-slate-700">
                Candidate Full Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="candidateName"
                placeholder="e.g. John Doe"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                className="text-sm h-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && candidateNameInput.trim()) {
                    handleInviteCandidate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInviteCandidate}
              disabled={!candidateNameInput.trim() || creatingSession}
              className={cn(
                "text-xs text-white font-semibold shadow-xs transition-colors",
                !candidateNameInput.trim() || creatingSession
                  ? "bg-slate-300 hover:bg-slate-300 cursor-not-allowed opacity-60 text-slate-500"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {creatingSession ? "Generating..." : "Generate Invite Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
