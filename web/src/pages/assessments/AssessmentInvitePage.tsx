import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import FieldError from "@/components/FieldError";
import LoadError from "@/components/LoadError";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { assessmentsApi } from "@/services/assessments";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { copyText } from "@/utils/clipboard";
import { interviewUrl } from "@/utils/interviewUrl";
import { MAX_TEXT_FIELD_LENGTH } from "@/utils/validation";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowRight, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Link2 } from "lucide-react";
import type { Assessment, Session } from "@/types";

// key is a session id, or "new" for the link card shown right after creating a session.
interface CopyResult {
  key: number | "new";
  ok: boolean;
}

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copyResult,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copyResult: CopyResult | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rakamin-light-cyan text-xs font-semibold text-primary">
          {index}
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-sm font-medium">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-muted-foreground">
              Started {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
        <SessionStatusBadge session={session} />
        {(isPending || isLive) && (
          <Button variant="ghost" size="sm" onClick={() => onCopy(session.id)}>
            {copyResult?.key === session.id && copyResult.ok ? (
              <>
                <Check /> Copied
              </>
            ) : copyResult?.key === session.id ? (
              <span className="text-destructive">Copy failed — copy the link manually</span>
            ) : (
              <>
                <Copy /> Copy link
              </>
            )}
          </Button>
        )}
        {isLive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
          >
            <Eye /> Monitor
          </Button>
        )}
        {isEnded && session.end_reason !== "error" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)
            }
          >
            Results <ArrowRight />
          </Button>
        )}
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [candidateNameError, setCandidateNameError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await assessmentsApi.getSessions(Number(id));
      setSessions(res.data.sessions);
    } catch {
      // Transient poll failure — keep the current list and retry on the next interval.
    }
  }, [id]);

  const loadPage = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([assessmentsApi.get(Number(id)), assessmentsApi.getSessions(Number(id))])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .catch((requestError: unknown) =>
        setLoadError(
          getApiErrorStatus(requestError) === 404
            ? "This assessment doesn't exist or was deleted."
            : getApiErrorMessage(requestError, "Failed to load the assessment."),
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setCandidateNameError(null);
    setInviteError(null);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    // Enter and a click can both fire before the first request resolves.
    if (creatingSession) return;
    const candidateName = candidateNameInput.trim();
    if (!candidateName) {
      setCandidateNameError("Candidate name is required");
      return;
    }

    setCreatingSession(true);
    setCandidateNameError(null);
    setInviteError(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateName);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
    } catch (requestError: unknown) {
      setInviteError(getApiErrorMessage(requestError, "Failed to create the invite link."));
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = async (url: string, key: CopyResult["key"]) => {
    const ok = await copyText(url);
    setCopyResult({ key, ok });
    if (ok) setTimeout(() => setCopyResult(null), 2000);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader backTo="/assessments" backLabel="Back to assessments" title="Assessment" />
        <LoadError message={loadError} onRetry={loadPage} />
      </div>
    );
  }

  const skillCount = assessment?.skills?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo="/assessments"
        backLabel="Back to assessments"
        eyebrow="Assessment"
        title={assessment?.name ?? "—"}
        description={
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {assessment?.time_limit_min} min · {skillCount} skill{skillCount === 1 ? "" : "s"}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/assessments/${id}/edit`)}>
              <Pencil /> Edit
            </Button>
            <Button onClick={openInviteDialog} disabled={creatingSession}>
              <Plus />
              {creatingSession ? "Creating..." : "Invite Candidate"}
            </Button>
          </>
        }
      />

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleInviteCandidate();
            }}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>Invite Candidate</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="candidate-name">
                Candidate name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                maxLength={MAX_TEXT_FIELD_LENGTH}
                value={candidateNameInput}
                onChange={(event) => {
                  setCandidateNameInput(event.target.value);
                  if (candidateNameError) setCandidateNameError(null);
                }}
                aria-invalid={!!candidateNameError}
                aria-describedby={candidateNameError ? "candidate-name-error" : undefined}
                autoFocus
              />
              {candidateNameError && (
                <div id="candidate-name-error" role="alert">
                  <FieldError message={candidateNameError} />
                </div>
              )}
              {inviteError && <Notice variant="error">{inviteError}</Notice>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingSession}>
                {creatingSession ? "Creating..." : "Create Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link */}
      <Dialog
        open={newSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNewSession(null);
            setCopyResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {newSession && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-rakamin-light-cyan text-primary">
                  <Link2 className="h-5 w-5" />
                </div>
                <DialogTitle>Invite link ready</DialogTitle>
                <DialogDescription>
                  Share this private interview link with {newSession.candidate_name}.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label="Interview link"
                  value={interviewUrl(newSession)}
                  readOnly
                  className="min-w-0 flex-1 font-mono text-sm"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  className="shrink-0 sm:px-6"
                  onClick={() => copyLink(interviewUrl(newSession), "new")}
                >
                  {copyResult?.key === "new" && copyResult.ok ? (
                    <>
                      <Check /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy /> Copy link
                    </>
                  )}
                </Button>
              </div>
              {copyResult?.key === "new" && !copyResult.ok && (
                <Notice variant="error">
                  Copy failed — select the link above and copy it manually
                </Notice>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sessions list */}
      <section className="space-y-3">
        <h2 className="font-semibold">
          Candidates
          {sessions.length > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground">({sessions.length})</span>
          )}
        </h2>

        {sessions.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No candidates yet"
            description='Click "Invite Candidate" to generate an interview link.'
          />
        ) : (
          <Card className="divide-y overflow-hidden">
            {sessions.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                index={sessions.length - i}
                assessmentId={id!}
                onCopy={(sid) => {
                  const s = sessions.find((x) => x.id === sid);
                  if (s) copyLink(interviewUrl(s), sid);
                }}
                copyResult={copyResult}
              />
            ))}
          </Card>
        )}
      </section>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Skills assessed</h2>
          <ul className="flex flex-wrap gap-2">
            {assessment.skills.map((s) => (
              <li
                key={s.id ?? s.skill_label}
                className="flex items-center gap-2 rounded-full border bg-card py-1 pl-3 pr-1 text-sm shadow-sm"
              >
                <span>{s.skill_label}</span>
                <span className="rounded-full bg-rakamin-light-cyan px-2 py-0.5 text-xs font-medium text-primary">
                  expected {LEVEL_LABELS[s.expected_level]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
