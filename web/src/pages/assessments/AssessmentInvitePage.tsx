import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import PageHeader from "@/components/layout/PageHeader";
import StatePanel from "@/components/layout/StatePanel";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus } from "lucide-react";
import type { Assessment, Session } from "@/types";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3.5 px-3 sm:px-4 border-b border-foreground/10 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 shrink-0 border border-foreground/15 text-xs font-medium text-muted-foreground font-display">
          {index}
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-medium truncate">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-10 sm:pl-0">
        {isPending && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Awaiting
          </span>
        )}
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="border border-foreground/10 divide-y">
          {[1, 2].map((i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 sm:pb-0">
      <PageHeader
        back={
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground mt-1.5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
        title={assessment?.name ?? "—"}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {assessment?.time_limit_min} min · {assessment?.skills?.length ?? 0} skills
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={openInviteDialog}
              disabled={creatingSession}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {creatingSession ? "Creating..." : "Invite Candidate"}
            </Button>
          </>
        }
      />

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Invite Candidate</DialogTitle>
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

      {newSession && (
        <div className="border border-primary/30 bg-accent/50 px-4 py-4 space-y-3">
          <p className="text-sm font-medium">
            {newSession.candidate_name ? (
              <>Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:</>
            ) : (
              <>New invite link ready — share with your candidate:</>
            )}
          </p>
          <div className="flex items-center gap-2 border border-foreground/10 px-3 py-2 bg-card">
            <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
              {newSession.invite_url}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full sm:w-auto">
            {newSessionCopied ? (
              <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
            )}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Candidates
          {sessions.length > 0 && (
            <span className="ml-2 text-sm text-muted-foreground font-sans font-normal">
              ({sessions.length})
            </span>
          )}
        </h2>

        {sessions.length === 0 ? (
          <StatePanel
            variant="empty"
            title="No candidates yet"
            description='Use "Invite Candidate" to generate an interview link.'
          />
        ) : (
          <div className="border border-foreground/10 bg-card/40">
            {sessions.map((session, i) => (
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
      </div>

      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="space-y-3 border-t border-foreground/10 pt-6">
          <h2 className="font-display text-lg font-semibold tracking-tight">Skills assessed</h2>
          <ul className="space-y-2">
            {assessment.skills.map((s) => (
              <li
                key={s.id ?? s.skill_label}
                className={cn("flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground")}
              >
                <span className="text-foreground">{s.skill_label}</span>
                <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mobile sticky invite */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 border-t border-foreground/10 bg-card/95 backdrop-blur px-4 py-3 z-30">
        <Button className="w-full" onClick={openInviteDialog} disabled={creatingSession}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {creatingSession ? "Creating..." : "Invite Candidate"}
        </Button>
      </div>
    </div>
  );
}
