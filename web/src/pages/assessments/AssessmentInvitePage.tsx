import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CandidateResultsMenu from "@/components/assessment/CandidateResultsMenu";
import { Callout } from "@/components/ui/callout";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { formatDate } from "@/utils/datetime";
import { candidateReviewStatus } from "@/components/review/reviewText";
import { Copy, Check, Eye, FileCheck2, Loader2, Pencil, Clock, Plus, UserCheck, UserRound } from "lucide-react";
import type { Assessment, Session } from "@/types";
import { useRetryFocus } from "@/hooks/useRetryFocus";

// The portfolio state and what still needs a human, instead of one green
// "Completed" for every finished interview (N15).
function PortfolioStatus({ session }: { session: Session }) {
  if (session.portfolio_status === "failed") return <StatusBadge tone="danger">Portfolio failed</StatusBadge>;
  if (session.portfolio_status === "generating") return <StatusBadge tone="info" icon={Loader2}>Generating</StatusBadge>;
  if (session.portfolio_status !== "ready") return <StatusBadge tone="neutral">No portfolio yet</StatusBadge>;

  return (
    <>
      <StatusBadge tone="neutral" icon={FileCheck2}>Portfolio ready</StatusBadge>
      {candidateReviewStatus(session.review_summary ?? []).map(({ text, tone }) => (
        <StatusBadge key={text} tone={tone} icon={tone === "success" ? UserCheck : undefined}>{text}</StatusBadge>
      ))}
    </>
  );
}

function needsReview(session: Session) {
  return (session.review_summary?.length ?? 0) > 0;
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
  // The number only names a candidate without a name; it is not shown.
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="text-sm font-medium [overflow-wrap:anywhere]">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-muted-foreground">
              Started {formatDate(session.started_at)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isPending && <StatusBadge tone="warning">Awaiting candidate</StatusBadge>}
        {isLive && <StatusBadge tone="info">Live</StatusBadge>}
        {isEnded && session.end_reason === "error" && <StatusBadge tone="danger">Failed</StatusBadge>}
        {isEnded && session.end_reason !== "error" && <PortfolioStatus session={session} />}

        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check aria-hidden="true" className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy aria-hidden="true" className="h-3 w-3 mr-1" /> Copy link</>
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
              <Eye aria-hidden="true" className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <CandidateResultsMenu assessmentId={assessmentId} sessionId={session.id} candidateName={displayName} />
          )}
        </div>
      </div>
    </li>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [inviteFailed, setInviteFailed] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [reviewFilter, setReviewFilter] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch(() => setLoadFailed(true)).finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);
  const { headingRef, markRetry } = useRetryFocus(loading);

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
    setInviteFailed(false);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } catch {
      setInviteFailed(true);
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

  const back = { to: "/assessments", label: "Back to assessments" };

  if (loading) {
    return (
      <PageShell>
        <div aria-busy="true" aria-label="Loading candidates" className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </PageShell>
    );
  }

  if (loadFailed || !assessment) {
    return (
      <PageShell>
        <PageHeader ref={headingRef} title="Candidates" back={back} />
        <ErrorState title="Could not load this assessment" description="Check your connection, then try again." onRetry={() => { markRetry(); load(); }} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        ref={headingRef}
        title={assessment.name}
        back={back}
        description={
          <span className="flex items-center gap-1.5">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            {assessment.time_limit_min} min · {assessment.skills?.length ?? 0} skills
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
              <Pencil aria-hidden="true" className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
            <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5 mr-1.5" />
              {creatingSession ? "Creating..." : "Invite Candidate"}
            </Button>
          </>
        }
      />

      {inviteFailed && (
        <Callout variant="error" role="alert" title="Could not create the invite link">
          No link was created. Try again.
        </Callout>
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
          <>
            {sessions.some((s) => s.review_summary !== undefined) && (
              <div role="group" aria-label="Show candidates" className="flex gap-2">
                <Button type="button" size="sm" variant={reviewFilter ? "outline" : "default"} aria-pressed={!reviewFilter} className="max-sm:min-w-11"
                        onClick={() => setReviewFilter(false)}>All</Button>
                <Button type="button" size="sm" variant={reviewFilter ? "default" : "outline"} aria-pressed={reviewFilter} className="max-sm:min-w-11"
                        onClick={() => setReviewFilter(true)}>Needs review</Button>
              </div>
            )}
            {reviewFilter && !sessions.some(needsReview) ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No candidates need review.</p>
            ) : (
              <Card>
                <ul className="divide-y">
                  {sessions.map((session, i) => (reviewFilter && !needsReview(session)) ? null : (
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
                </ul>
              </Card>
            )}
          </>
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
                  {LEVEL_LABELS[s.expected_level] && <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </PageShell>
  );
}
