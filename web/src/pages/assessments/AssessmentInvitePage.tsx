import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import ApiErrorList from "@/components/ApiErrorList";
import { useToast } from "@/components/ui/toast";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import { apiErrorMessages } from "@/utils/apiErrors";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Trash2 } from "lucide-react";
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
  const displayName = session.candidate_name || "Unnamed candidate";

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-foreground">
          {index}
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="break-words text-sm font-medium">{displayName}</div>
          {session.started_at && (
            <div className="text-sm text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
        {isPending && (
          <span className="flex items-center gap-2 text-sm text-amber-800">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
            Awaiting candidate
          </span>
        )}
        {isLive && (
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
            Live
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="flex items-center gap-2 text-sm text-destructive">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="flex items-center gap-2 text-sm text-green-700">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-700" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 px-3 text-sm"
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
              className="min-h-11 px-3 text-sm"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 px-3 text-sm"
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
  const toast = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [inviteErrors, setInviteErrors] = useState<string[]>([]);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  const loadAssessmentPage = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [aRes, sRes] = await Promise.all([
        assessmentsApi.get(Number(id)),
        assessmentsApi.getSessions(Number(id)),
      ]);
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAssessmentPage(); }, [loadAssessmentPage]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setInviteErrors([]);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setInviteErrors([]);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
      toast.success(
        created.candidate_name
          ? `Invite link created for ${created.candidate_name}.`
          : "Invite link created."
      );
    } catch (e: any) {
      setInviteErrors(apiErrorMessages(e, "Could not create the interview invite."));
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

  if (loadError || !assessment) {
    return (
      <div className="mx-auto max-w-3xl">
        <div role="alert" className="space-y-3 rounded-xl border bg-white p-6">
          <div>
            <h1 className="font-semibold">Assessment details could not be loaded</h1>
            <p className="mt-1 text-sm text-muted-foreground">Candidate sessions may not be up to date. Try loading this page again.</p>
          </div>
          <Button variant="outline" className="min-h-11" onClick={loadAssessmentPage}>Try again</Button>
          <Button asChild variant="ghost"><Link to="/assessments">Back to assessments</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-5 border-b pb-6">
        <Link to="/assessments" className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Assessments
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="break-words text-xl font-semibold tracking-tight sm:text-3xl">{assessment.name}</h1>
            <p className="text-sm leading-6 text-muted-foreground">Manage candidate invites and review completed interviews for this role.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => navigate(`/assessments/${id}/edit`)}>
              <Pencil aria-hidden="true" className="mr-1.5 h-4 w-4" /> Edit assessment
            </Button>
            <Button className="min-h-11 flex-1 sm:flex-none" onClick={openInviteDialog} disabled={creatingSession}>
              <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
            {creatingSession ? "Creating..." : "Invite candidate"}
          </Button>
          <ConfirmActionDialog
            trigger={<Button variant="ghost" className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" className="mr-1.5 h-4 w-4" /> Delete</Button>}
            title="Delete this assessment?"
            description="It will be removed from active assessments. Existing interview sessions remain stored."
            actionLabel="Delete assessment"
            errorMessage="Could not delete assessment. Try again."
            successMessage="Assessment deleted."
            onConfirm={async () => {
              await assessmentsApi.delete(Number(id));
              navigate("/assessments");
            }}
          />
          </div>
        </div>
      </div>

      <section aria-label="Assessment overview" className="grid grid-cols-1 divide-y rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">Interview length</p>
          <p className="mt-1 flex items-center gap-2 font-semibold"><Clock aria-hidden="true" className="h-4 w-4 text-primary" />{assessment.time_limit_min} minutes</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">Interview language</p>
          <p className="mt-1 font-semibold">{assessment.language === "id" ? "Bahasa Indonesia" : "English"}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">Skills assessed</p>
          <p className="mt-1 font-semibold">{assessment.skills?.length ?? 0} skills</p>
        </div>
      </section>

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
            <ApiErrorList errors={inviteErrors} />
            <p className="text-sm text-muted-foreground">Optional. Helps you identify this session later.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setShowInviteDialog(false)} disabled={creatingSession}>Cancel</Button>
            <Button className="min-h-11" onClick={handleInviteCandidate} disabled={creatingSession}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link */}
      {newSession && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">
              {newSession.candidate_name
                ? <>Link for <span className="font-semibold">{newSession.candidate_name}</span> is ready. Share it with your candidate:</>
                : <>New invite link is ready. Share it with your candidate:</>}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
              <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                {newSession.invite_url}
              </span>
            </div>
            <Button variant="outline" onClick={copyNewSessionLink} className="min-h-11 w-full">
              {newSessionCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sessions list */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Candidates</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Share a unique interview link with each candidate.</p>
          </div>
          <span className="text-sm font-medium text-muted-foreground">{sessions.length} {sessions.length === 1 ? "candidate" : "candidates"}</span>
        </div>

        {sessions.length === 0 ? (
          <div className="space-y-4 rounded-xl border bg-card px-6 py-12 text-center">
            <UserRound aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">No candidates invited</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an interview link to start collecting candidate results.
              </p>
            </div>
            <Button className="min-h-11" onClick={openInviteDialog}>
              <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" /> Invite candidate
            </Button>
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
      </section>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <section className="space-y-4 border-t pt-7">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Skills assessed</h2>
            <p className="mt-1 text-sm text-muted-foreground">Competencies included in this interview plan.</p>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {assessment.skills.map((s) => (
                <div key={s.id ?? s.skill_label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="font-medium">{s.skill_label}</span>
                  <span className="text-sm text-muted-foreground">Expected level: {LEVEL_LABELS[s.expected_level]}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
