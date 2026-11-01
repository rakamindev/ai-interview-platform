import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  UserRound,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import type { Assessment, Session } from "@/types";

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
  const displayName = session.candidate_name || `Candidate #${index}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
          {index}
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
            {displayName}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {session.started_at ? (
              <span>Started {new Date(session.started_at).toLocaleDateString()}</span>
            ) : (
              <span>Created {new Date(session.created_at || Date.now()).toLocaleDateString()}</span>
            )}
            {session.duration_seconds && (
              <>
                <span>·</span>
                <span className="font-mono">{Math.round(session.duration_seconds / 60)} mins</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <div>
          {isPending && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Awaiting candidate
            </span>
          )}
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Interview
            </span>
          )}
          {isEnded && session.end_reason === "error" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Interrupted
            </span>
          )}
          {isEnded && session.end_reason !== "error" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Completed
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-medium"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Copy Link
                </>
              )}
            </Button>
          )}

          {isLive && (
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Monitor Live
            </Button>
          )}

          {isEnded && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              View Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "ended">("all");

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Polling for live session updates
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, id: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const name = s.candidate_name || "";
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "pending") return s.status === "pending";
      if (statusFilter === "active") return s.status === "active";
      if (statusFilter === "ended") return s.status === "ended";
      return true;
    });
  }, [sessions, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 pb-12">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/assessments"
            className="mt-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {assessment?.name ?? "Assessment"}
              </h1>
              <PrivacyBadge />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="h-3 w-3" />
                {assessment?.time_limit_min} mins
              </span>
              <span>·</span>
              <span>{assessment?.skills?.length ?? 0} skills configured</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${id}/edit`)}
            className="h-8 text-xs"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            size="sm"
            onClick={openInviteDialog}
            disabled={creatingSession}
            className="h-8 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* UU PDP Compliance Banner */}
      <PrivacyBadge variant="banner" />

      {/* Invite Candidate Modal */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Generate Candidate Interview Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name" className="text-xs font-semibold">
                Candidate Name / Identifier
              </Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Raden Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Note: Under UU PDP No. 27/2022, candidate names & personal identifiers are automatically masked before any Gemini AI processing.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleInviteCandidate}>
              Generate Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session banner */}
      {newSession && (
        <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs font-semibold">
                {newSession.candidate_name ? (
                  <>Interview link generated for <span className="underline">{newSession.candidate_name}</span>:</>
                ) : (
                  <>New invite link ready to share with candidate:</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 border border-emerald-300/50 rounded-lg px-3 py-2 bg-background">
              <span className="flex-1 text-xs font-mono truncate text-foreground select-all break-all">
                {newSession.invite_url}
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={copyNewSessionLink}
                className="h-7 px-3 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700"
              >
                {newSessionCopied ? (
                  <><Check className="h-3 w-3 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3 mr-1" /> Copy</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Candidates Session List Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight">Candidates</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {sessions.length}
            </span>
          </div>

          {/* Filter tabs */}
          {sessions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter candidate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs w-36 sm:w-44"
                />
              </div>
              <div className="flex bg-muted/60 p-0.5 rounded-lg border text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    statusFilter === "all" ? "bg-background shadow-2xs font-bold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    statusFilter === "active" ? "bg-background shadow-2xs font-bold text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => setStatusFilter("ended")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    statusFilter === "ended" ? "bg-background shadow-2xs font-bold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="border border-dashed rounded-2xl p-10 text-center space-y-3 bg-muted/10">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No candidates invited yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Invite your first candidate to create a personalized tokenized interview session.
              </p>
            </div>
            <Button size="sm" onClick={openInviteDialog} className="shadow-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite Candidate
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
            No candidates match the current filter or search query.
          </div>
        ) : (
          <Card className="rounded-xl overflow-hidden border-border/80 shadow-2xs">
            <CardContent className="p-0 divide-y">
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
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Skills Included & Behavioral Benchmarks */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight">Evaluated Skills Scope</h2>
            <span className="text-xs text-muted-foreground">
              {assessment.skills.length} target competencies
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {assessment.skills.map((s) => (
              <div
                key={s.id ?? s.skill_label}
                className="rounded-xl border bg-card/60 p-3 space-y-1 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground truncate">{s.skill_label}</span>
                  <span className="shrink-0 px-2 py-0.5 rounded-full font-mono font-bold bg-primary/10 text-primary text-[10px]">
                    Expected: {LEVEL_LABELS[s.expected_level] || `L${s.expected_level}`}
                  </span>
                </div>
                {s.scope_include && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {s.scope_include}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
