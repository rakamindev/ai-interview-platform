import { useEffect, useState, useCallback } from "react";
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
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  UserRound,
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
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-4 gap-3 sm:gap-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Candidate info & status */}
      <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold text-muted-foreground shrink-0">
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

        {/* Mobile status badge */}
        <div className="sm:hidden shrink-0">
          {isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Awaiting
            </span>
          )}
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          )}
          {isEnded && session.end_reason === "error" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Failed
            </span>
          )}
          {isEnded && session.end_reason !== "error" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Done
            </span>
          )}
        </div>
      </div>

      {/* Desktop status & Action buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0">
        {/* Desktop status badge */}
        <div className="hidden sm:block">
          {isPending && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Awaiting candidate
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-primary font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          )}
          {isEnded && session.end_reason === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Failed
            </span>
          )}
          {isEnded && session.end_reason !== "error" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 sm:h-7 px-2.5 sm:px-2 text-xs flex-1 sm:flex-none"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <>
                  <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1" /> Copy link
                </>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 px-2.5 sm:px-2 text-xs flex-1 sm:flex-none"
              onClick={() =>
                navigate(
                  `/assessments/${assessmentId}/sessions/${session.id}/monitor`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 px-2.5 sm:px-2 text-xs flex-1 sm:flex-none font-medium"
              onClick={() =>
                navigate(
                  `/assessments/${assessmentId}/sessions/${session.id}/portfolio`,
                )
              }
            >
              Results & Fit/Gap
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
  const [candidateEmailInput, setCandidateEmailInput] = useState("");
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateEmailInput("");
    setCandidateNameInput("");
    setInviteError(null);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    const email = candidateEmailInput.trim();
    if (!email || !email.includes("@")) {
      setInviteError("Candidate email is required.");
      return;
    }

    setCreatingSession(true);
    setInviteError(null);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        email,
        candidateNameInput.trim() || undefined,
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
    } catch {
      setInviteError("Failed to create invite session. Please check input.");
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-2.5">
          <Link
            to="/assessments"
            className="text-muted-foreground hover:text-foreground mt-0.5 p-1 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {assessment?.name ?? "—"}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-medium">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {assessment?.time_limit_min} min ·{" "}
              {assessment?.skills?.length ?? 0} skills
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none text-xs"
            onClick={() => navigate(`/assessments/${id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none text-xs font-semibold"
            onClick={openInviteDialog}
            disabled={creatingSession}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-email">
                Candidate email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="candidate-email"
                type="email"
                placeholder="e.g. candidate@example.com"
                value={candidateEmailInput}
                onChange={(e) => setCandidateEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                Required — connects this assessment session to the candidate's
                account.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="candidate-name">Candidate name</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              />
              <p className="text-xs text-muted-foreground">
                Optional — display name for this session.
              </p>
            </div>

            {inviteError && (
              <p className="text-xs text-destructive font-medium">
                {inviteError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteCandidate} disabled={creatingSession}>
              {creatingSession ? "Creating..." : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link */}
      {newSession && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">
              {newSession.candidate_name ? (
                <>
                  Link for{" "}
                  <span className="font-semibold">
                    {newSession.candidate_name}
                  </span>{" "}
                  ready — share with your candidate:
                </>
              ) : (
                <>New invite link ready — share with your candidate:</>
              )}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
              <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                {newSession.invite_url}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyNewSessionLink}
              className="w-full"
            >
              {newSessionCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link
                </>
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
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({sessions.length})
              </span>
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
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <ul className="space-y-1">
              {assessment.skills.map((s) => (
                <li
                  key={s.id ?? s.skill_label}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span>•</span>
                  <span>{s.skill_label}</span>
                  <span className="text-xs">
                    (expected {LEVEL_LABELS[s.expected_level]})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
