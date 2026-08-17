import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound } from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  assessmentId,
  onCopy,
  copiedId,
}: {
  session: Session;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${session.id}`;

  let progressProps = { label: "Unknown", colorClass: "bg-slate-200", segments: 3, activeSegments: 0 };
  
  if (isPending) {
    progressProps = { label: "Pending", colorClass: "bg-blue-400", segments: 3, activeSegments: 1 };
  } else if (isLive) {
    progressProps = { label: "In Progress", colorClass: "bg-emerald-400", segments: 3, activeSegments: 2 };
  } else if (isEnded && session.end_reason !== "error") {
    progressProps = { label: "Completed", colorClass: "bg-emerald-500", segments: 3, activeSegments: 3 };
  } else if (isEnded && session.end_reason === "error") {
    if (!session.audit_status) {
      progressProps = { label: "Needs Review", colorClass: "bg-amber-400", segments: 3, activeSegments: 3 };
    } else if (session.audit_status === "objection_filed") {
      progressProps = { label: "Appeal Filed", colorClass: "bg-rose-400", segments: 3, activeSegments: 3 };
    } else if (session.audit_status === "resolved") {
      progressProps = { label: "Appeal Resolved", colorClass: "bg-emerald-500", segments: 3, activeSegments: 3 };
    } else if (session.audit_status === "retake_approved") {
      progressProps = { label: "Voided (Retake)", colorClass: "bg-slate-300", segments: 3, activeSegments: 3 };
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-4 sm:px-5 hover:bg-slate-50/80 transition-all group border-b border-slate-100 last:border-0 gap-3 sm:gap-0">
      
      {/* Col 1: Candidate Info */}
      <div className="flex flex-col space-y-1 min-w-0 flex-1 w-full sm:w-auto">
        <div className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
          {displayName}
        </div>
        {session.started_at && (
          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
            <Clock className="h-3 w-3 opacity-60" />
            {new Date(session.started_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
        {/* Col 2: Segmented Progress (Fixed width to align rows) */}
        <div className="flex flex-col gap-1.5 w-[120px] sm:w-[140px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{progressProps.label}</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: progressProps.segments }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                  i < progressProps.activeSegments ? progressProps.colorClass : "bg-slate-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Col 3: Actions (Fixed width to align rows) */}
        <div className="flex items-center justify-end min-w-[90px] sm:min-w-[100px]">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-auto px-3 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-600"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3.5 w-3.5 sm:mr-1.5 text-emerald-600" /> <span className="hidden sm:inline">Copied</span></>
              ) : (
                <><Copy className="h-3.5 w-3.5 sm:mr-1.5 text-slate-400" /> <span className="hidden sm:inline">Copy link</span></>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-auto px-3 text-xs font-medium border-emerald-200 hover:bg-emerald-50 text-emerald-700"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Monitor</span>
            </Button>
          )}
          {isEnded && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-auto px-4 text-xs font-medium shadow-sm hover:shadow-md transition-all"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              Results
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "live" | "review" | "completed">("review");
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Poll while any session is live or pending
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
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
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

  const filteredSessions = sessions.filter(session => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return session.status === "pending";
    if (statusFilter === "live") return session.status === "active";
    if (statusFilter === "completed") return session.status === "ended" && (session.end_reason !== "error" || session.audit_status === "resolved" || session.audit_status === "retake_approved");
    if (statusFilter === "review") return session.status === "ended" && session.end_reason === "error" && (!session.audit_status || session.audit_status === "objection_filed");
    return true;
  });

  const counts = {
    all: sessions.length,
    pending: sessions.filter(s => s.status === "pending").length,
    live: sessions.filter(s => s.status === "active").length,
    completed: sessions.filter(s => s.status === "ended" && (s.end_reason !== "error" || s.audit_status === "resolved" || s.audit_status === "retake_approved")).length,
    review: sessions.filter(s => s.status === "ended" && s.end_reason === "error" && (!s.audit_status || s.audit_status === "objection_filed")).length,
  };

  const FilterTab = ({ id, label, count, alert }: { id: typeof statusFilter, label: string, count: number, alert?: boolean }) => {
    const isActive = statusFilter === id;
    return (
      <button
        onClick={() => setStatusFilter(id)}
        className={`relative flex items-center gap-2 py-3 text-[13px] font-medium transition-colors border-b-2 -mb-[1px] outline-none ${
          isActive
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
        }`}
      >
        {label}
        <span
          className={`flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none transition-colors ${
            isActive
              ? "bg-slate-100 text-slate-700"
              : "bg-slate-50 text-slate-400"
          } ${alert && count > 0 && isActive ? "!bg-rose-100 !text-rose-700" : ""} ${alert && count > 0 && !isActive ? "!bg-rose-50 !text-rose-600" : ""}`}
        >
          {count}
        </span>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-6.5rem)] sm:h-[calc(100dvh-6.5rem)] px-2 sm:px-0 pb-2">
      <div className="shrink-0 space-y-4 sm:space-y-6 mt-2 sm:mt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/assessments" className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 -ml-1 sm:-ml-2">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none truncate pr-2">{assessment?.name ?? "—"}</h1>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-[13px] text-slate-500 font-medium">
              <span className="flex items-center gap-1"><Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> {assessment?.time_limit_min} min</span>
              <span className="text-slate-300">•</span>
              <span>{assessment?.skills?.length ?? 0} skills</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto ml-11 sm:ml-0">
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)} className="shadow-sm hover:shadow-md transition-all h-8 sm:h-9">
            <Pencil className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all h-8 sm:h-9">
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{creatingSession ? "Creating..." : "Invite Candidate"}</span>
            <span className="sm:hidden">{creatingSession ? "..." : "Invite"}</span>
          </Button>
        </div>
      </div>

      {/* Assessment skills detail - Compact with Expand */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-1 ml-11 sm:ml-13 mb-2 sm:mb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-2 hidden sm:block">Skills</span>
          {(isSkillsExpanded ? assessment.skills : assessment.skills.slice(0, 3)).map((s) => (
            <div key={s.id ?? s.skill_label} className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200/60 bg-white shadow-sm text-xs font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50">
              <span>{s.skill_label}</span>
              <span className="text-slate-400 border-l border-slate-200 pl-1.5 ml-0.5" title={LEVEL_DESCRIPTIONS[s.expected_level]}>
                {LEVEL_LABELS[s.expected_level]} - {LEVEL_DESCRIPTIONS[s.expected_level]}
              </span>
            </div>
          ))}
          {!isSkillsExpanded && assessment.skills.length > 3 && (
            <button 
              onClick={() => setIsSkillsExpanded(true)}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-100 transition-colors cursor-pointer"
            >
              +{assessment.skills.length - 3} more
            </button>
          )}
          {isSkillsExpanded && assessment.skills.length > 3 && (
            <button 
              onClick={() => setIsSkillsExpanded(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200/60 transition-colors cursor-pointer"
            >
              Show less
            </button>
          )}
        </div>
      )}

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="candidate-name">Candidate name</Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Budi Santoso"
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Optional — helps you identify this session later.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteCandidate}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link */}
      {newSession && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">
              {newSession.candidate_name
                ? <>Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:</>
                : <>New invite link ready — share with your candidate:</>}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
              <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                {newSession.invite_url}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full">
              {newSessionCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
      </div>

      <Separator className="shrink-0 my-6" />

      {/* Sessions list */}
      <div className="flex-1 min-h-0 flex flex-col space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 py-1 sm:py-3 px-2 sm:px-0 hidden sm:block">
            Candidates
          </h2>
          {sessions.length > 0 && (
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto custom-scrollbar px-2 sm:px-0 w-full sm:w-auto pb-1 sm:pb-0">
              <FilterTab id="all" label="All" count={counts.all} />
              <FilterTab id="pending" label="Pending" count={counts.pending} />
              <FilterTab id="live" label="Live" count={counts.live} />
              <FilterTab id="review" label="Needs Review" count={counts.review} alert />
              <FilterTab id="completed" label="Completed" count={counts.completed} />
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">No candidates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Invite Candidate" to generate an interview link.
              </p>
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <p className="text-sm font-medium text-muted-foreground">No candidates match the selected filter</p>
          </div>
        ) : (
          <Card className="bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
            <CardContent className="p-0 overflow-y-auto">
              {filteredSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
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
    </div>
  );
}
