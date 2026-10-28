import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_TIERS } from "@/components/assessment/LevelRadio";
import {
  ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus,
  UserRound, Layers, ExternalLink, FileText, CheckCircle2,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

// Note #8: Frontend interview URL (port 5173, not backend 3001)
function buildFrontendInviteUrl(session: Session): string {
  return `${window.location.origin}/join/${session.invite_token}`;
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
  onCopy: (id: number, url: string) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  const frontendUrl = buildFrontendInviteUrl(session);

  const durationText = session.duration_seconds
    ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
    : null;

  // Note #17: click row to view details / monitor / results
  const handleRowClick = () => {
    if (isEnded && session.end_reason !== "error") {
      navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`);
    } else if (isLive) {
      navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`);
    }
  };

  return (
    <div className="flex items-center justify-between py-3.5 px-4 transition-colors hover:bg-slate-50/50">
      <div className="flex items-center gap-3 min-w-0">
        {/* Note #7: Ascending index number */}
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 shrink-0">
          {index}
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 truncate">{displayName}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {session.started_at && (
              <span>{new Date(session.started_at).toLocaleDateString()}</span>
            )}
            {durationText && (
              <>
                <span>·</span>
                <span>{durationText}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {/* Status badges with dot indicator */}
        {isPending && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Scheduled
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-teal-50 text-teal-700 border-teal-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            Live Now
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-700 border-rose-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs rounded-lg border-slate-200 bg-white hover:bg-slate-50 hover:border-teal-300 hover:text-primary transition-all shadow-2xs"
              onClick={() => onCopy(session.id, frontendUrl)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3 w-3 mr-1 text-emerald-600" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1 text-slate-400" /> Copy link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs text-primary border-primary/30 hover:bg-teal-50/50 rounded-lg shadow-2xs font-medium"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs shadow-xs font-medium rounded-lg"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              <FileText className="h-3 w-3 mr-1" /> Results
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

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    // Note #7: sort ascending (oldest first = lowest index at top, newest at bottom)
    const sorted = [...res.data.sessions].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    setSessions(sorted);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      const sorted = [...sRes.data.sessions].sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
      );
      setSessions(sorted);
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
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      // Note #7: append new session to bottom (ascending order)
      setSessions((prev) => [...prev, created]);
      setShowInviteDialog(false);
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (sessionId: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession) return;
    const url = buildFrontendInviteUrl(newSession);
    navigator.clipboard.writeText(url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
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
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">
              {assessment?.name ?? "—"}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {assessment?.time_limit_min} min interview
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {assessment?.skills?.length ?? 0} skills assessed
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate(`/assessments/${id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Assessment
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={openInviteDialog}
            disabled={creatingSession}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Add Candidate"}
          </Button>
        </div>
      </div>

      {/* Invite Dialog (Mockup style) */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Candidate to Interview</DialogTitle>
            <DialogDescription className="text-xs">
              Role: <strong className="text-slate-800">{assessment?.name}</strong> ({assessment?.time_limit_min} minutes)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name" className="text-xs font-semibold">
                Candidate Name
              </Label>
              <Input
                id="candidate-name"
                placeholder="e.g. John Doe, Jane Smith"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Optional: helps you identify this candidate in the results dashboard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteCandidate} disabled={creatingSession}>
              {creatingSession ? "Generating..." : "Generate Interview Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session banner (Note #38: Proper interview link & share message) */}
      {newSession && (
        <Card className="border-primary/40 bg-primary/5 shadow-xs animate-in fade-in duration-300">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {newSession.candidate_name ? (
                  <>Interview link for <span className="text-primary font-bold">{newSession.candidate_name}</span> is ready:</>
                ) : (
                  <>Candidate interview link created successfully:</>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-muted-foreground hover:text-slate-800"
                onClick={() => setNewSession(null)}
              >
                Dismiss
              </Button>
            </div>

            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-2xs">
              <span className="text-xs text-muted-foreground select-none">🔗</span>
              <span className="flex-1 text-xs font-mono truncate text-slate-800 select-all">
                {buildFrontendInviteUrl(newSession)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button size="sm" onClick={copyNewSessionLink} className="text-xs flex-1 min-w-[130px]">
                {newSessionCopied ? (
                  <><Check className="h-3.5 w-3.5 mr-1.5 text-white" /> Link Copied!</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link</>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => {
                  const message = `Hello ${newSession.candidate_name || "Candidate"},\n\nYou are invited to participate in the Rakamin AI Interview for the position of ${assessment?.name || "Target Role"}.\n\nPlease access the interview link below when you are ready:\n${buildFrontendInviteUrl(newSession)}\n\nDuration: ${assessment?.time_limit_min || 45} Minutes\nPlease ensure a stable internet connection and use headphones/earphones.\n\nBest of luck!\nRakamin Recruitment Team`;
                  navigator.clipboard.writeText(message);
                  setNewSessionCopied(true);
                  setTimeout(() => setNewSessionCopied(false), 2000);
                }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> Copy Invitation Message
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(buildFrontendInviteUrl(newSession), "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Session Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Candidates List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <UserRound className="h-4 w-4 text-primary" />
            Candidates
            {sessions.length > 0 && (
              <span className="text-muted-foreground font-normal">({sessions.length})</span>
            )}
          </h2>
          {/* Note #17: Hint text */}
          {sessions.some((s) => s.status === "ended" && s.end_reason !== "error") && (
            <span className="text-[11px] text-muted-foreground">
              Click a completed row to view results →
            </span>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="border border-dashed rounded-xl p-10 text-center space-y-3 bg-white">
            <UserRound className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-slate-700">No candidates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Candidate" to generate an AI interview link.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openInviteDialog}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Candidate
            </Button>
          </div>
        ) : (
          <Card className="shadow-xs border border-slate-200/90 bg-white overflow-hidden">
            <CardContent className="p-0 divide-y divide-slate-100">
              {/* Note #7: ascending order (index 1, 2, 3... newest at bottom) */}
              {sessions.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  index={i + 1}
                  assessmentId={id!}
                  onCopy={copyLink}
                  copiedId={copiedId}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Assessment Skills Assessed Details */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Skills Assessed ({assessment.skills.length})
            </h2>
            <Link
              to={`/assessments/${id}/edit`}
              className="text-xs text-primary hover:underline font-medium"
            >
              Configure Skills →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {assessment.skills.map((s) => {
              const tier = LEVEL_TIERS[s.expected_level];
              return (
                <div
                  key={s.id ?? s.skill_label}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200/80 bg-white text-xs shadow-2xs"
                >
                  <span className="font-semibold text-slate-800 truncate pr-2">
                    {s.skill_label}
                  </span>
                  {tier && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0"
                    >
                      {tier.code} · {tier.name}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
