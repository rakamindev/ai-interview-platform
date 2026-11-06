import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import { LEVEL_LABELS } from "@/utils/constants";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  UserRound,
  RotateCcw,
  Ban,
  AlertCircle,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

type SessionAction = "revoke" | "reissue";

function errorMessage(error: unknown): string {
  const errors = (
    error as { response?: { data?: { errors?: Array<{ message?: string }> } } }
  )?.response?.data?.errors;
  return errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function inviteStatusOf(session: Session): string {
  if (session.invite_status) return session.invite_status;
  if (session.status === "ended" || session.status === "failed") return "completed";
  return session.status;
}

function StatusChip({ session }: { session: Session }) {
  const status = inviteStatusOf(session);

  if (session.status === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }

  switch (status) {
    case "revoked":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
          Invite revoked
        </span>
      );
    case "expired":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Invite expired
        </span>
      );
    case "active":
      return (
        <span className="flex items-center gap-1 text-xs text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Live
        </span>
      );
    case "completed":
      return (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Completed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-amber-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Awaiting candidate
        </span>
      );
  }
}

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  onRevoke,
  onReissue,
  copiedId,
  busyAction,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  onRevoke: (session: Session) => void;
  onReissue: (session: Session) => void;
  copiedId: number | null;
  busyAction: { id: number; action: SessionAction } | null;
}) {
  const navigate = useNavigate();
  const status = inviteStatusOf(session);
  const isLive = status === "active";
  const isPending = status === "pending";
  const isEnded = session.status === "ended" && session.end_reason !== "error";
  const isRevocable = isPending;
  const isReissuable = status === "expired" || status === "revoked";
  const displayName = session.candidate_name || `Candidate ${index}`;
  const expiry = formatDateTime(session.invite_expires_at);
  const isBusy = busyAction?.id === session.id;

  return (
    <div className="flex flex-col gap-2 py-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-medium truncate">{displayName}</div>
          {isPending && expiry && (
            <div className="text-xs text-muted-foreground">Expires {expiry}</div>
          )}
          {!isPending && session.started_at && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
          {isReissuable && expiry && (
            <div className="text-xs text-muted-foreground">Last expiry {expiry}</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
        <StatusChip session={session} />

        <div className="flex flex-wrap items-center gap-1.5">
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

          {isReissuable && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isBusy}
              onClick={() => onReissue(session)}
            >
              <RotateCcw className={`h-3 w-3 mr-1 ${isBusy && busyAction?.action === "reissue" ? "animate-spin" : ""}`} />
              {isBusy && busyAction?.action === "reissue" ? "Reissuing..." : "Reissue link"}
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

          {isEnded && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
              >
                Results
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/transcript`)}
              >
                Transcript
              </Button>
            </>
          )}

          {isRevocable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              disabled={isBusy}
              onClick={() => onRevoke(session)}
            >
              <Ban className="h-3 w-3 mr-1" /> Revoke
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{ id: number; action: SessionAction } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Session | null>(null);

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

  // Poll only while an interview is actually live. Pending invites now change
  // state server-side (expiry/revocation) when the assessor acts, so polling
  // every pending invite forever was wasted traffic.
  useEffect(() => {
    const hasLive = sessions.some((s) => s.status === "active");
    if (!hasLive) return;
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
    setActionError(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, sessionId: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  const handleRevoke = async (session: Session) => {
    setBusyAction({ id: session.id, action: "revoke" });
    setActionError(null);
    try {
      const res = await sessionsApi.revokeInvite(session.id);
      setSessions((prev) => prev.map((s) => (s.id === session.id ? res.data.session : s)));
      if (newSession?.id === session.id) setNewSession(null);
      setRevokeTarget(null);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleReissue = async (session: Session) => {
    setBusyAction({ id: session.id, action: "reissue" });
    setActionError(null);
    try {
      const res = await sessionsApi.reissueInvite(session.id);
      const updated = { ...res.data.session, invite_url: res.data.invite_url };
      setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)));
      setNewSession(updated);
      setNewSessionCopied(false);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{assessment?.name ?? "—"}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              {assessment?.time_limit_min} min · {assessment?.skills?.length ?? 0} skills
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{actionError}</span>
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

      {/* Revoke confirmation */}
      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke this interview link?</DialogTitle>
            <DialogDescription>
              The candidate will see a clear "link cancelled" message and cannot start the interview. You can reissue a new link afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Keep link</Button>
            <Button
              variant="destructive"
              onClick={() => revokeTarget && handleRevoke(revokeTarget)}
              disabled={busyAction?.action === "revoke"}
            >
              {busyAction?.action === "revoke" ? "Revoking..." : "Revoke link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created / reissued session invite link */}
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
            <p className="text-xs text-muted-foreground">
              Expires {formatDateTime(newSession.invite_expires_at) ?? "in 72 hours"}. Previous links stay invalid.
            </p>
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

      <Separator />

      {/* Sessions list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Candidates
            {sessions.length > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">({sessions.length})</span>
            )}
          </h2>
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
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
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
                  onRevoke={setRevokeTarget}
                  onReissue={handleReissue}
                  copiedId={copiedId}
                  busyAction={busyAction}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <ul className="space-y-1">
              {assessment.skills.map((s) => (
                <li key={s.id ?? s.skill_label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  <span>{s.skill_label}</span>
                  <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
