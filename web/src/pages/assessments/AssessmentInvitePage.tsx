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
import BadgeDot, { type BadgeTone } from "@/components/design/BadgeDot";
import LevelChip from "@/components/design/LevelChip";
import Banner from "@/components/design/Banner";
import NotFoundPage from "@/pages/NotFoundPage";
import { assessmentsApi } from "@/services/assessments";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  UserRound,
  Link2,
  Mic2,
  ListTree,
  TrendingUp,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

interface SessionStatus {
  tone: BadgeTone;
  label: string;
}

function sessionStatus(session: Session): SessionStatus {
  if (session.status === "active") return { tone: "live", label: "Live now" };
  if (session.status === "ended" && session.end_reason === "error")
    return { tone: "fail", label: "Failed" };
  if (session.status === "ended") return { tone: "ok", label: "Completed" };
  return { tone: "ready", label: "Not started" };
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
  const displayName = session.candidate_name || `Candidate ${index}`;
  const status = sessionStatus(session);

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-3.5 align-middle">
        <div className="text-sm font-semibold text-foreground">{displayName}</div>
      </td>
      <td className="px-3 py-3.5 align-middle font-mono text-xs text-muted-foreground">
        {session.started_at ? new Date(session.started_at).toLocaleDateString() : "—"}
      </td>
      <td className="px-3 py-3.5 align-middle">
        <BadgeDot tone={status.tone}>{status.label}</BadgeDot>
      </td>
      <td className="px-3 py-3.5 text-right align-middle">
        {isPending && (
          <Button variant="ghost" size="sm" onClick={() => onCopy(session.id)}>
            {copiedId === session.id ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy link
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
            <Eye className="h-3 w-3" /> Monitor
          </Button>
        )}
        {isEnded && session.end_reason !== "error" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
          >
            Results
          </Button>
        )}
      </td>
    </tr>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await assessmentsApi.getSessions(Number(id));
      setSessions(res.data.sessions);
    } catch {
      // Transient poll failure: keep the last known sessions.
    }
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setLoadError(null);
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch((err) => {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setNotFound(true);
        return;
      }
      setLoadError("We couldn't load this assessment. Please try again.");
    }).finally(() => setLoading(false));
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
    setInviteError(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
      setCandidateNameInput("");
    } catch {
      setInviteError("Could not create the invite link. Please try again.");
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

  if (notFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-[14px]" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/assessments" aria-label="Back to assessments">
            <ArrowLeft className="h-3.5 w-3.5" /> Assessments
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground">
            {assessment?.name ?? "—"}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{assessment?.time_limit_min} min</span>
            <span>·</span>
            <span>{assessment?.skills?.length ?? 0} skills assessed</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {loadError && <Banner tone="fail">{loadError}</Banner>}

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          {inviteError && <Banner tone="fail">{inviteError}</Banner>}
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

      <div className="grid gap-[18px] lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-5">
          {/* Newly created session invite link */}
          {newSession && (
            <div className="flex items-center gap-3.5 rounded-[14px] border border-[#bfe3e5] bg-gradient-to-br from-brand-softer to-card px-4 py-4">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-brand text-white">
                <Link2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {newSession.candidate_name
                    ? `Link for ${newSession.candidate_name} is ready`
                    : "New invite link is ready"}
                </p>
                <div className="mt-1.5 truncate rounded-lg border border-border bg-white px-2.5 py-1.5 font-mono text-xs text-brand-deep">
                  {newSession.invite_url}
                </div>
              </div>
              <Button size="sm" onClick={copyNewSessionLink} className="shrink-0">
                {newSessionCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Sessions */}
          <div className="rounded-[14px] border border-border bg-card shadow-sm">
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div>
                <div className="font-display text-sm font-semibold text-foreground">Candidates</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {sessions.length} invite{sessions.length === 1 ? "" : "s"} sent
                </p>
              </div>
            </div>
            <div className="px-2 pb-2 pt-2">
              {!loadError && sessions.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <span className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-full border border-dashed border-[var(--border-strong)] text-faint">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">No candidates yet</p>
                  <p className="mx-auto mt-1 max-w-[340px] text-xs text-muted-foreground">
                    Click "Invite Candidate" to generate an interview link.
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="px-3 pb-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-faint">
                        Candidate
                      </th>
                      <th className="px-3 pb-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-faint">
                        Started
                      </th>
                      <th className="px-3 pb-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-faint">
                        Status
                      </th>
                      <th className="px-3 pb-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-faint">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
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
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Skills assessed */}
          {assessment?.skills && assessment.skills.length > 0 && (
            <div className="rounded-[14px] border border-border bg-card shadow-sm">
              <div className="px-5 pt-4">
                <div className="font-display text-sm font-semibold text-foreground">
                  Skills assessed
                </div>
              </div>
              <div className="space-y-2.5 px-5 pb-5 pt-3">
                {assessment.skills.map((s) => (
                  <div key={s.id ?? s.skill_label} className="flex items-center gap-2.5">
                    <LevelChip level={s.expected_level} />
                    <span className="text-sm text-foreground">{s.skill_label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aside */}
        <aside className="rounded-[14px] border border-border bg-card shadow-sm">
          <div className="px-5 pt-4">
            <div className="font-display text-sm font-semibold text-foreground">
              What happens next
            </div>
          </div>
          <div className="space-y-3 px-5 pb-5 pt-3 text-xs text-muted-foreground">
            <div className="flex gap-3 border-b border-dashed border-border pb-3">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-deep">
                <Mic2 className="h-4 w-4" />
              </span>
              <span>
                <strong className="font-semibold text-foreground">Candidate speaks</strong> — the AI
                conducts the interview conversationally, following up where needed.
              </span>
            </div>
            <div className="flex gap-3 border-b border-dashed border-border pb-3">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-deep">
                <ListTree className="h-4 w-4" />
              </span>
              <span>
                <strong className="font-semibold text-foreground">Transcript &amp; coverage</strong>{" "}
                update live — you can watch anytime from the Monitor screen.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-deep">
                <TrendingUp className="h-4 w-4" />
              </span>
              <span>
                <strong className="font-semibold text-foreground">Skill portfolio</strong> is
                generated after the session ends — roughly 2 minutes.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
