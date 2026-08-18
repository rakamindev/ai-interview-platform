import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS, LEVEL_BADGE_CLASSES } from "@/utils/constants";
import {
  ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound,
  Timer, ChevronDown, AlertTriangle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment, Session } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

const END_REASON_LABELS: Record<string, { label: string; description: string }> = {
  manual_candidate: {
    label: "Ended by candidate",
    description: "The candidate clicked 'End Interview' before all skills were covered.",
  },
  manual_assessor: {
    label: "Ended by assessor",
    description: "The session was manually terminated from the monitor view.",
  },
  all_covered: {
    label: "All skills covered",
    description: "The AI successfully covered all configured skills before the time limit.",
  },
  time_ceiling: {
    label: "Time limit reached",
    description: "The session ended because the maximum time limit was reached.",
  },
  error: {
    label: "Session error",
    description: "An unexpected error occurred during the session.",
  },
  superseded: {
    label: "Superseded",
    description: "This invite was replaced by a newer session for the same candidate.",
  },
};

// ── Status badge ──────────────────────────────────────────────────────────

function StatusDot({ session }: { session: Session }) {
  const isLive = session.status === "active";
  const isPending = session.status === "pending";
  const isFailed = session.status === "ended" && session.end_reason === "error";
  const isSuperseded = session.status === "ended" && session.end_reason === "superseded";
  const isCompleted = session.status === "ended" && !isFailed && !isSuperseded;

  if (isPending)
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        Awaiting candidate
      </span>
    );
  if (isLive)
    return (
      <span className="flex items-center gap-1 text-xs text-primary font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
        Live now
      </span>
    );
  if (isFailed)
    return (
      <span className="flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Failed
      </span>
    );
  if (isSuperseded)
    return (
      // Neutral grey — not an error, just no longer active
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
        Superseded
      </span>
    );
  if (isCompleted)
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        Completed
      </span>
    );
  return null;
}

// ── Candidate grouping ────────────────────────────────────────────────────
//
// Identity priority (per design spec):
//   1. candidate_id  (Rakamin account)
//   2. candidate_email (normalised lowercase)
//   3. session_id    (no identity info — each session is its own "group")
//
// candidate_name is NEVER used as an identity key — it is display-only.

function candidateKey(session: Session): string {
  if (session.candidate_id) return `id:${session.candidate_id}`;
  if (session.candidate_email) return `email:${session.candidate_email.toLowerCase().trim()}`;
  return `sid:${session.id}`;
}

interface CandidateGroup {
  key: string;
  displayName: string;
  displayEmail: string | null;
  sessions: Session[];
}

function groupSessionsByCandidate(sessions: Session[]): CandidateGroup[] {
  const map = new Map<string, CandidateGroup>();

  // Process newest-first so within a group sessions stay newest-first
  const sorted = [...sessions].sort((a, b) => b.id - a.id);

  for (const s of sorted) {
    const key = candidateKey(s);
    if (!map.has(key)) {
      map.set(key, {
        key,
        displayName: s.candidate_name ?? "Unknown candidate",
        displayEmail: s.candidate_email ?? null,
        sessions: [],
      });
    }
    map.get(key)!.sessions.push(s);
  }

  return Array.from(map.values());
}

function latestStatusLabel(group: CandidateGroup): { text: string; cls: string } | null {
  const latest = group.sessions[0];
  if (!latest) return null;
  if (latest.status === "active")
    return { text: "Live now", cls: "text-primary font-medium" };
  if (latest.status === "pending")
    return { text: "Awaiting candidate", cls: "text-amber-600" };
  if (latest.end_reason === "error")
    return { text: "Last: Failed", cls: "text-destructive" };
  if (latest.end_reason === "superseded")
    return { text: "Last: Superseded", cls: "text-muted-foreground" };
  return { text: "Last: Completed", cls: "text-green-600" };
}

// ── CandidateCard ─────────────────────────────────────────────────────────

function CandidateCard({
  group,
  index,
  assessmentId,
  copiedId,
  onCopy,
  onRetry,
  retryingId,
  navigate,
}: {
  group: CandidateGroup;
  index: number;
  assessmentId: string;
  copiedId: number | null;
  onCopy: (session: Session) => void;
  onRetry: (session: Session) => void;
  retryingId: number | null;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLive = group.sessions.some((s) => s.status === "active");
  const statusInfo = latestStatusLabel(group);

  useEffect(() => {
    if (hasLive) setExpanded(true);
  }, [hasLive]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* ── Candidate header ────────────────────────────────────────────── */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
            {index}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{group.displayName}</p>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              {group.displayEmail && (
                <span className="text-muted-foreground truncate max-w-[180px]">
                  {group.displayEmail}
                </span>
              )}
              {group.displayEmail && <span className="text-muted-foreground">·</span>}
              <span className="text-muted-foreground">
                {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
              </span>
              {statusInfo && (
                <><span className="text-muted-foreground">·</span>
                  <span className={statusInfo.cls}>{statusInfo.text}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* ── Session history ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t bg-muted/20">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_auto_auto] gap-x-3 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b">
            <span>#</span>
            <span>Date · Duration</span>
            <span>Status</span>
            <span />
          </div>

          {group.sessions.map((session, si) => {
            const sessionNum = group.sessions.length - si;
            const isLive = session.status === "active";
            const isPending = session.status === "pending";
            const isFailed = session.status === "ended" && session.end_reason === "error";
            const isSuperseded = session.status === "ended" && session.end_reason === "superseded";
            const isCompleted = session.status === "ended" && !isFailed && !isSuperseded;
            const endInfo = session.end_reason ? END_REASON_LABELS[session.end_reason] : null;

            return (
              <div
                key={session.id}
                className={cn(
                  "border-b last:border-0",
                  isFailed && "bg-destructive/[0.03]",
                  isSuperseded && "opacity-60"
                )}
              >
                {/* Session row */}
                <div className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-x-3 px-4 py-2.5">
                  {/* Session number */}
                  <span className="text-xs font-mono text-muted-foreground">
                    #{sessionNum}
                  </span>

                  {/* Date + duration */}
                  <div className="text-xs text-muted-foreground min-w-0">
                    {session.started_at
                      ? new Date(session.started_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })
                      : session.created_at
                        ? new Date(session.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })
                        : "—"}
                    {session.duration_seconds ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        <Timer className="h-3 w-3" />
                        {formatDuration(session.duration_seconds)}
                      </span>
                    ) : null}
                  </div>

                  {/* Status */}
                  <StatusDot session={session} />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isPending && (
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); onCopy(session); }}
                      >
                        {copiedId === session.id
                          ? <><Check className="h-3 w-3 mr-1" />Copied</>
                          : <><Copy className="h-3 w-3 mr-1" />Copy link</>}
                      </Button>
                    )}
                    {isLive && (
                      <Button
                        variant="outline" size="sm" className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />Monitor
                      </Button>
                    )}
                    {isCompleted && (
                      <Button
                        variant="outline" size="sm" className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`);
                        }}
                      >
                        Results
                      </Button>
                    )}
                  </div>
                </div>

                {/* Failed detail + retry */}
                {isFailed && (
                  <div className="mx-4 mb-2.5 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-medium text-destructive">
                        {endInfo?.label ?? "Session error"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {endInfo?.description}
                      </p>
                    </div>
                    {!group.sessions.some(s => s.status === "ended" && s.end_reason !== "error" && s.end_reason !== "superseded") && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/5 shrink-0"
                        disabled={retryingId === session.id}
                        onClick={(e) => { e.stopPropagation(); onRetry(session); }}
                      >
                        {retryingId === session.id
                          ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Creating…</>
                          : <><RefreshCw className="h-3 w-3 mr-1" />New session</>}
                      </Button>
                    )}
                  </div>
                )}

                {/* Superseded note — subtle, no action needed */}
                {isSuperseded && (
                  <div className="mx-4 mb-2.5 text-xs text-muted-foreground italic">
                    {endInfo?.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

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
  const [candidateEmailInput, setCandidateEmailInput] = useState("");
  const [retryingId, setRetryingId] = useState<number | null>(null);

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
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setCandidateEmailInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined,
        undefined,
        candidateEmailInput.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCopyLink = (session: Session) => {
    const url = `${window.location.origin}/interview/${session.invite_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_token) return;
    const url = `${window.location.origin}/interview/${newSession.invite_token}`;
    navigator.clipboard.writeText(url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  const handleRetry = async (failedSession: Session) => {
    setRetryingId(failedSession.id);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        failedSession.candidate_name ?? undefined,
        undefined,
        failedSession.candidate_email ?? undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setRetryingId(null);
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

  const groups = groupSessionsByCandidate(sessions);
  const completedCount = sessions.filter(
    (s) => s.status === "ended" && s.end_reason !== "error" && s.end_reason !== "superseded"
  ).length;
  const liveCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{assessment?.name ?? "—"}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />{assessment?.time_limit_min} min
              </span>
              <span>·</span>
              <span>
                {assessment?.skills?.length ?? 0} skill{assessment?.skills?.length !== 1 ? "s" : ""}
              </span>
              {completedCount > 0 && (
                <><span>·</span><span className="text-green-600">{completedCount} completed</span></>
              )}
              {liveCount > 0 && (
                <><span>·</span>
                  <span className="text-primary font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {liveCount} live
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating…" : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* ── Invite dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name">Candidate name</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidate-email">Candidate email</Label>
              <Input
                id="candidate-email"
                type="email"
                placeholder="e.g. budi@company.com"
                value={candidateEmailInput}
                onChange={(e) => setCandidateEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              />
              <p className="text-xs text-muted-foreground">
                Email identifies the candidate across sessions. Leave blank if unknown.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteCandidate}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New session link banner ────────────────────────────────────────── */}
      {newSession && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">
              {newSession.candidate_name
                ? <>Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:</>
                : "New invite link ready — share with your candidate:"}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
              <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                {`${window.location.origin}/interview/${newSession.invite_token}`}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full">
              {newSessionCopied
                ? <><Check className="h-3.5 w-3.5 mr-1.5" />Copied!</>
                : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy link</>}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Candidates list ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">
          Candidates
          {groups.length > 0 && (
            <span className="ml-1.5 text-muted-foreground font-normal">({groups.length})</span>
          )}
        </h2>

        {groups.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <UserRound className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No candidates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Invite Candidate" to generate an interview link.
              </p>
            </div>
            <Button size="sm" onClick={openInviteDialog}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite first candidate
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group, gi) => (
              <CandidateCard
                key={group.key}
                group={group}
                index={groups.length - gi}
                assessmentId={id!}
                copiedId={copiedId}
                onCopy={handleCopyLink}
                onRetry={handleRetry}
                retryingId={retryingId}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Skills assessed ────────────────────────────────────────────────── */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <div className="space-y-2">
              {assessment.skills.map((s) => (
                <div key={s.id ?? s.skill_label} className="flex items-center justify-between text-sm py-1">
                  <span className="text-foreground">{s.skill_label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Expected</span>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", LEVEL_BADGE_CLASSES[s.expected_level])}>
                      {LEVEL_LABELS[s.expected_level]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
