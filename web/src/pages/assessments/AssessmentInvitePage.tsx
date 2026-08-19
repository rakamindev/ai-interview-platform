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
import { Pagination } from "@/components/ui/pagination";
import { assessmentsApi } from "@/services/assessments";
import { candidatesApi } from "@/services/candidates";
import { CandidateDetailPanel } from "@/components/candidates/CandidateDetailPanel";
import { openGmailCompose, buildCandidateInviteEmail } from "@/utils/gmailCompose";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import type { Assessment, Candidate, PaginationMeta, Session } from "@/types";
import { formatRelativeTime } from "@/utils/formatRelativeTime";

function SessionRow({
  session,
  assessmentId,
  roleTitle,
  timeLimitMin,
  selected,
  onSelect,
  onCopy,
  copiedId,
}: {
  session: Session;
  assessmentId: string;
  roleTitle: string;
  timeLimitMin?: number;
  selected: boolean;
  onSelect: () => void;
  onCopy: (id: number) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || "Unnamed candidate";
  const usedMin = session.duration_seconds ? Math.round(session.duration_seconds / 60) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View session for ${displayName}`}
      className={`flex items-center justify-between py-3 px-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground" title="Candidate ID">
          {session.candidate_id ?? "—"}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {(session.started_at || session.created_at) && (
              <span>{formatRelativeTime(session.started_at ?? session.created_at!)}</span>
            )}
            {(isLive || isEnded) && timeLimitMin && (
              <>
                <span>·</span>
                <span>{usedMin !== null ? `${usedMin} / ${timeLimitMin} min` : `${timeLimitMin} min`}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isPending && (
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

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
          {isPending && session.candidate_email && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const { subject, body } = buildCandidateInviteEmail({
                  candidateName: session.candidate_name,
                  roleTitle,
                  timeLimitMin,
                  expiresAt: session.expires_at,
                  inviteUrl: session.invite_url,
                });
                openGmailCompose({ to: session.candidate_email!, subject, body });
              }}
            >
              <Mail className="h-3 w-3 mr-1" /> Share on Gmail
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
  const [sessionsMeta, setSessionsMeta] = useState<PaginationMeta | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionSearch, setSessionSearch] = useState("");
  const [debouncedSessionSearch, setDebouncedSessionSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [candidateEmailInput, setCandidateEmailInput] = useState("");
  const [candidatePhoneInput, setCandidatePhoneInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const defaultExpiryDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  };

  const loadSessions = useCallback(async (page = sessionsPage, q = debouncedSessionSearch) => {
    const res = await assessmentsApi.getSessions(Number(id), page, q || undefined);
    setSessions(res.data.sessions);
    setSessionsMeta(res.data.meta);
  }, [id, sessionsPage, debouncedSessionSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSessionSearch(sessionSearch), 300);
    return () => clearTimeout(t);
  }, [sessionSearch]);

  useEffect(() => {
    assessmentsApi.get(Number(id))
      .then((res) => setAssessment(res.data.assessment))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadSessions(sessionsPage, debouncedSessionSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsPage, debouncedSessionSearch]);

  useEffect(() => {
    setSessionsPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSessionSearch]);

  // Poll while any session on the current page is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(() => loadSessions(), 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  // Load full candidate detail (contact info, CV, other sessions) on selection
  useEffect(() => {
    if (selectedCandidateId === null) {
      setSelectedCandidate(null);
      return;
    }
    setDetailLoading(true);
    candidatesApi.get(selectedCandidateId)
      .then((res) => setSelectedCandidate(res.data.candidate))
      .catch(() => setSelectedCandidate(null))
      .finally(() => setDetailLoading(false));
  }, [selectedCandidateId]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setCandidateEmailInput("");
    setCandidatePhoneInput("");
    setExpiresAtInput(defaultExpiryDate());
    setInviteError(null);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    const name = candidateNameInput.trim();
    const email = candidateEmailInput.trim();
    if (!name || !email) {
      setInviteError("Name and email are required.");
      return;
    }

    setCreatingSession(true);
    setInviteError(null);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), {
        candidate_name: name,
        candidate_email: email,
        candidate_phone: candidatePhoneInput.trim() || undefined,
        expires_at: expiresAtInput || undefined,
      });
      const created = res.data.session;
      setNewSession(created);
      loadSessions(1, debouncedSessionSearch);
      setSessionsPage(1);
      setNewSessionCopied(false);
      setShowLinkDialog(true);
    } catch (err) {
      setShowInviteDialog(true);
      setInviteError(
        (err as { response?: { data?: { errors?: { message: string }[] } } })?.response?.data?.errors?.[0]?.message
          ?? "Failed to create invite link."
      );
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

  const openNewSessionInGmail = () => {
    if (!newSession) return;
    const { subject, body } = buildCandidateInviteEmail({
      candidateName: newSession.candidate_name,
      roleTitle: assessment?.name ?? "the role",
      timeLimitMin: assessment?.time_limit_min,
      expiresAt: newSession.expires_at,
      inviteUrl: newSession.invite_url,
    });
    openGmailCompose({ to: newSession.candidate_email ?? "", subject, body });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
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

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {inviteError && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
                {inviteError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name">Candidate name *</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidate-email">Email *</Label>
              <Input
                id="candidate-email"
                type="email"
                placeholder="budi@example.com"
                value={candidateEmailInput}
                onChange={(e) => setCandidateEmailInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to identify this candidate across all their interviews.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidate-phone">Phone</Label>
              <Input
                id="candidate-phone"
                placeholder="Optional"
                value={candidatePhoneInput}
                onChange={(e) => setCandidatePhoneInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expires-at">Link expires on</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAtInput}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpiresAtInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteCandidate}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link — popup */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link is ready</DialogTitle>
          </DialogHeader>
          {newSession && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                {newSession.candidate_name
                  ? <>Share this with <span className="font-medium text-foreground">{newSession.candidate_name}</span>:</>
                  : <>Share this with your candidate:</>}
              </p>
              <input
                readOnly
                value={newSession.invite_url}
                onFocus={(e) => e.target.select()}
                className="w-full border rounded-md px-3 py-2 bg-muted/30 text-sm font-mono text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="flex-1">
                  {newSessionCopied ? (
                    <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openNewSessionInGmail}
                  disabled={!newSession.candidate_email}
                  className="flex-1"
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Share on Gmail
                </Button>
              </div>
              {newSession.candidate_email && (
                <p className="text-xs text-muted-foreground">
                  Opens Gmail addressed to <span className="font-medium">{newSession.candidate_email}</span>
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      {/* Sessions list + candidate detail panel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">
            Candidates
            {sessionsMeta && (
              <span className="ml-1.5 text-muted-foreground font-normal">({sessionsMeta.total_count})</span>
            )}
          </h2>
          <div className="relative w-56">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              className="pl-8 h-8 text-sm"
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
            />
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">
                {debouncedSessionSearch ? `No candidates match "${debouncedSessionSearch}".` : "No candidates yet"}
              </p>
              {!debouncedSessionSearch && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Invite Candidate" to generate an interview link.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className={selectedCandidateId !== null ? "grid md:grid-cols-[1fr_360px] gap-4 items-start" : ""}>
            <div className="space-y-2">
              <Card>
                <CardContent className="p-0 divide-y">
                  {sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      assessmentId={id!}
                      roleTitle={assessment?.name ?? "the role"}
                      timeLimitMin={assessment?.time_limit_min}
                      selected={selectedCandidateId === session.candidate_id}
                      onSelect={() => session.candidate_id && setSelectedCandidateId(session.candidate_id)}
                      onCopy={(sid) => {
                        const s = sessions.find((x) => x.id === sid);
                        if (s) copyLink(s, sid);
                      }}
                      copiedId={copiedId}
                    />
                  ))}
                </CardContent>
              </Card>
              {sessionsMeta && <Pagination meta={sessionsMeta} onPageChange={setSessionsPage} />}
            </div>
            {selectedCandidateId !== null && (
              <Card className="sticky top-4 hidden md:block">
                <CardContent className="p-5">
                  <CandidateDetailPanel candidate={selectedCandidate} loading={detailLoading} showSessionActions={false} />
                </CardContent>
              </Card>
            )}
          </div>
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
