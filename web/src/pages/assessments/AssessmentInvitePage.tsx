import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import AssessmentFormDialog from "@/components/assessment/AssessmentFormDialog";
import MetricStrip from "@/components/workspace/MetricStrip";
import { showRequestError } from "@/lib/requestToast";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, BarChart3, Check, CheckCircle2, CircleAlert, Clock, Copy, Eye, Pencil, Plus, Radio, RefreshCw, UserRound } from "lucide-react";
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
  const consentDeclined = isPending && session.consent_declined;
  const consentAccepted = isPending && session.consent_accepted;
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-medium">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {consentDeclined && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Consent declined
          </span>
        )}
        {consentAccepted && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Ready to start
          </span>
        )}
        {isPending && !consentDeclined && !consentAccepted && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting candidate
          </span>
        )}
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {isPending && !consentDeclined && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              aria-label={`Copy invite link for ${displayName}`}
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
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [copyFailureUrl, setCopyFailureUrl] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const inviteUrlRef = useRef<HTMLSpanElement>(null);
  const pollErrorNotifiedRef = useRef(false);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    pollErrorNotifiedRef.current = false;
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    setLoadError(false);
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .catch((error) => {
        setLoadError(true);
        showRequestError(error, "Couldn’t load this assessment.");
      })
      .finally(() => setLoading(false));
  }, [id, retryCount]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(() => {
      loadSessions().catch((error) => {
        if (!pollErrorNotifiedRef.current) {
          showRequestError(error, "Session updates are temporarily unavailable.");
          pollErrorNotifiedRef.current = true;
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
    } catch (error) {
      showRequestError(error, "Couldn’t create the invite link. Please try again.");
    } finally {
      setCreatingSession(false);
    }
  };

  const writeToClipboard = async (url: string): Promise<boolean> => {
    try {
      if (!navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };

  const copyLink = async (session: Session, id: number) => {
    setCopyFailureUrl(null);
    if (await writeToClipboard(session.invite_url)) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }

    // No clipboard access: show the link so it can still be copied by hand.
    setCopyFailureUrl(session.invite_url);
  };

  const copyNewSessionLink = async () => {
    if (!newSession?.invite_url) return;
    setCopyFailureUrl(null);

    if (await writeToClipboard(newSession.invite_url)) {
      setNewSessionCopied(true);
      setTimeout(() => setNewSessionCopied(false), 2000);
      return;
    }

    const node = inviteUrlRef.current;
    if (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    setCopyFailureUrl(newSession.invite_url);
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

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/assessments" aria-label="Back to assessments" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium">Invitations</span>
        </div>
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3" role="alert">
          <p className="text-sm text-destructive">We could not load this assessment's invitations.</p>
          <p className="text-xs text-muted-foreground">No candidate link changed. Retry to load it again.</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((count) => count + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }
  const liveCount = sessions.filter((session) => session.status === "active").length;
  const completedCount = sessions.filter((session) => session.status === "ended" && session.end_reason !== "error").length;
  const failedCount = sessions.filter((session) => session.status === "ended" && session.end_reason === "error").length;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start justify-center gap-2 text-center min-w-0 sm:justify-start sm:text-left">
          <Link to="/assessments" aria-label="Back to assessments" className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{assessment?.name ?? "—"}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground sm:justify-start">
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{assessment?.time_limit_min} min</span>
              <span>{assessment?.skills?.length ?? 0} skills</span>
              <span>{sessions.length} candidates</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>
      <MetricStrip items={[
        { label: "Candidates", value: sessions.length, icon: BarChart3 },
        { label: "Live now", value: liveCount, icon: Radio, className: "text-primary" },
        { label: "Completed", value: completedCount, icon: CheckCircle2, className: "text-primary" },
        { label: "Failed", value: failedCount, icon: CircleAlert, className: failedCount > 0 ? "text-destructive" : "text-muted-foreground" },
      ]} />

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
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleInviteCandidate} disabled={creatingSession}>
              {creatingSession ? "Creating..." : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssessmentFormDialog
        mode="edit"
        assessmentId={Number(id)}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSaved={(updated) => setAssessment(updated)}
      />

      {/* Newly created session invite link */}
      {newSession && (
        <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">
              {newSession.candidate_name
                ? <>Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:</>
                : <>New invite link ready — share with your candidate:</>}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
              <span
                ref={inviteUrlRef}
                className="flex-1 text-sm font-mono truncate text-muted-foreground select-all"
              >
                {newSession.invite_url}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Copy invite link"
              onClick={copyNewSessionLink}
              className="w-full"
            >
              {newSessionCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {copyFailureUrl && (
        <div className="border border-destructive/40 rounded-lg p-3 space-y-1 text-sm" role="alert">
          <p className="text-destructive">
            This browser would not copy automatically. The link is selected below — copy it manually.
          </p>
          <p className="font-mono text-xs break-all select-all">{copyFailureUrl}</p>
        </div>
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
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-0 divide-y">
              {sessions.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  index={sessions.length - i}
                  assessmentId={id!}
                  onCopy={(sid) => {
                    const s = sessions.find((x) => x.id === sid);
                    if (s) void copyLink(s, sid);
                  }}
                  copiedId={copiedId}
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
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold">Skills assessed</h2>
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
