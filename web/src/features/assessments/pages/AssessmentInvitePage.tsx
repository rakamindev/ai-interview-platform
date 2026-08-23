import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import DeleteConfirmDialog from "@/shared/components/DeleteConfirmDialog";
import EmptyState from "@/shared/components/EmptyState";
import ErrorState from "@/shared/components/ErrorState";
import ListRowSkeleton from "@/shared/components/ListRowSkeleton";
import Pagination from "@/shared/components/Pagination";
import LevelBadge from "@/features/portfolio/components/LevelBadge";
import { assessmentsApi } from "@/features/assessments/services/assessments";
import { cn, formatDateTime } from "@/shared/lib/utils";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  UserRound,
  Trash2,
  ClipboardList,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { Assessment } from "@/features/assessments/types";
import type { PaginationMeta, Session } from "@/shared/types";

type SessionStatusKey =
  | "expired"
  | "awaiting"
  | "live"
  | "failed"
  | "completed";

const STATUS_STYLES: Record<SessionStatusKey, string> = {
  expired: "bg-muted text-muted-foreground",
  awaiting: "bg-amber-100 text-amber-700",
  live: "bg-primary/15 text-primary",
  failed: "bg-destructive/10 text-destructive",
  completed: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<SessionStatusKey, string> = {
  expired: "Invite expired",
  awaiting: "Awaiting candidate",
  live: "Live",
  failed: "Failed",
  completed: "Completed",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
  onRename,
  onDelete,
  onExtend,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
  onRename: (session: Session) => void;
  onDelete: (session: Session) => void;
  onExtend: (session: Session) => void;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  const statusKey: SessionStatusKey = isPending
    ? session.expired
      ? "expired"
      : "awaiting"
    : isLive
      ? "live"
      : session.end_reason === "error"
        ? "failed"
        : "completed";

  return (
    <div className="flex items-center gap-4 py-4 px-6">
      <div
        className={cn(
          "relative flex items-center justify-center h-11 w-11 rounded-full text-xs font-semibold shrink-0",
          STATUS_STYLES[statusKey],
        )}
      >
        {session.candidate_name ? (
          initials(session.candidate_name)
        ) : (
          <UserRound className="h-4 w-4" />
        )}
        {isLive && (
          <span className="absolute -inset-0.5 rounded-full ring-2 ring-primary/50 animate-pulse" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-data text-muted-foreground shrink-0">
            #{index}
          </span>
          <span className="text-[15px] font-medium truncate">
            {displayName}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0",
              STATUS_STYLES[statusKey],
            )}
          >
            {STATUS_LABELS[statusKey]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {formatDateTime(session.created_at) && (
            <Badge variant="secondary" className="font-normal">
              Invited {formatDateTime(session.created_at)}
            </Badge>
          )}
          {isPending &&
            !session.expired &&
            formatDateTime(session.invite_expires_at) && (
              <Badge variant="outline" className="font-normal">
                Expires {formatDateTime(session.invite_expires_at)}
              </Badge>
            )}
          {formatDateTime(session.started_at) && (
            <Badge
              variant="outline"
              className="font-normal border-primary/30 bg-primary/10 text-primary"
            >
              Started {formatDateTime(session.started_at)}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <>
                  <Check className="h-3 w-3 mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" /> Copy link
                </>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                navigate(
                  `/assessments/${assessmentId}/sessions/${session.id}/monitor`,
                )
              }
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                navigate(
                  `/assessments/${assessmentId}/sessions/${session.id}/portfolio`,
                )
              }
            >
              Results
            </Button>
          )}
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onExtend(session)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="warning"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onRename(session)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!isLive && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onDelete(session)}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [inviteExpiryDays, setInviteExpiryDays] = useState("7");
  const [renamingSession, setRenamingSession] = useState<Session | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extendingSession, setExtendingSession] = useState<Session | null>(null);
  const [extendDays, setExtendDays] = useState("7");
  const [extending, setExtending] = useState(false);

  const loadSessions = useCallback(
    async (page: number) => {
      const res = await assessmentsApi.getSessions(Number(id), page);
      setSessions(res.data.sessions);
      setSessionsMeta(res.data.meta);
    },
    [id],
  );

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => setAssessment(res.data.assessment))
      .catch(() => {});
  }, [id]);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    setError(false);
    loadSessions(sessionsPage)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [loadSessions, sessionsPage]);

  useEffect(fetchSessions, [fetchSessions]);

  // Poll the currently-viewed page while any of its sessions is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(() => loadSessions(sessionsPage), 5000);
    return () => clearInterval(interval);
  }, [sessions, sessionsPage, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setInviteExpiryDays("7");
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
        Number(inviteExpiryDays),
      );
      setNewSession(res.data.session);
      // New invites always land on page 1 — jump there so the candidate is visible.
      setSessionsPage(1);
      await loadSessions(1);
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

  const openRenameDialog = (session: Session) => {
    setRenamingSession(session);
    setRenameInput(session.candidate_name ?? "");
  };

  const handleRename = async () => {
    if (!renamingSession) return;
    setRenaming(true);
    try {
      const res = await assessmentsApi.updateSession(
        renamingSession.id,
        renameInput.trim(),
      );
      setSessions((prev) =>
        prev.map((s) => (s.id === renamingSession.id ? res.data.session : s)),
      );
      setRenamingSession(null);
    } finally {
      setRenaming(false);
    }
  };

  const openExtendDialog = (session: Session) => {
    setExtendDays("7");
    setExtendingSession(session);
  };

  const handleExtend = async () => {
    if (!extendingSession) return;
    setExtending(true);
    try {
      const res = await assessmentsApi.extendInvite(
        extendingSession.id,
        Number(extendDays),
      );
      setSessions((prev) =>
        prev.map((s) => (s.id === extendingSession.id ? res.data.session : s)),
      );
      setExtendingSession(null);
    } finally {
      setExtending(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleting(true);
    try {
      await assessmentsApi.deleteSession(deletingSession.id);
      setSessions((prev) => prev.filter((s) => s.id !== deletingSession.id));
      setDeletingSession(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <ListRowSkeleton key={i} avatar />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/assessments"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/15 text-primary shrink-0">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold">
              {assessment?.name ?? "—"}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              <span className="font-data">
                {assessment?.time_limit_min}
              </span>{" "}
              min ·{" "}
              <span className="font-data">
                {assessment?.skills?.length ?? 0}
              </span>{" "}
              skills
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="warning"
            size="sm"
            onClick={() => navigate(`/assessments/${id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            size="sm"
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label htmlFor="invite-expiry">Invite expires in</Label>
              <Select
                value={inviteExpiryDays}
                onValueChange={setInviteExpiryDays}
              >
                <SelectTrigger id="invite-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteCandidate}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename candidate dialog */}
      <Dialog
        open={!!renamingSession}
        onOpenChange={(open) => !open && setRenamingSession(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="rename-candidate">Candidate name</Label>
            <Input
              id="rename-candidate"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingSession(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renaming}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deletingSession}
        onOpenChange={(open) => !open && setDeletingSession(null)}
        title="Delete this candidate?"
        description="This can't be undone. Their interview results and transcript, if any, will be deleted too."
        onConfirm={handleDeleteSession}
        loading={deleting}
      />

      {/* Extend invite confirmation */}
      <AlertDialog
        open={!!extendingSession}
        onOpenChange={(open) => !open && setExtendingSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              {extendingSession?.candidate_name || "This candidate"}'s invite
              link will be extended, counted from today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="extend-days">Extend by</Label>
            <Select value={extendDays} onValueChange={setExtendDays}>
              <SelectTrigger id="extend-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtend} disabled={extending}>
              {extending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Extend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Candidates
            {!!sessionsMeta?.total_count && (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({sessionsMeta.total_count})
              </span>
            )}
          </h2>
        </div>

        {error ? (
          <ErrorState message="Failed to load candidates." onRetry={fetchSessions} />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={UserRound}
            message="No candidates yet"
            description='Click "Invite Candidate" to generate an interview link.'
          />
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {sessions.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  // Global numbering: #1 is always the most recently invited candidate.
                  index={
                    sessionsMeta
                      ? (sessionsMeta.current_page - 1) *
                          sessionsMeta.per_page +
                        i +
                        1
                      : i + 1
                  }
                  assessmentId={id!}
                  onCopy={(sid) => {
                    const s = sessions.find((x) => x.id === sid);
                    if (s) copyLink(s, sid);
                  }}
                  copiedId={copiedId}
                  onRename={openRenameDialog}
                  onDelete={setDeletingSession}
                  onExtend={openExtendDialog}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {!error && sessionsMeta && (
          <Pagination
            currentPage={sessionsMeta.current_page}
            totalPages={sessionsMeta.total_pages}
            onPageChange={setSessionsPage}
          />
        )}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <div className="space-y-1.5">
              {assessment.skills.map((s) => (
                <div
                  key={s.id ?? s.skill_label}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5"
                >
                  <span className="text-sm font-medium">{s.skill_label}</span>
                  <LevelBadge level={s.expected_level} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
