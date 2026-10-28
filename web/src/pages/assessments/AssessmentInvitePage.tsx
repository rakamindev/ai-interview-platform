import { useEffect, useState, useCallback, useRef } from "react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
  Search,
  X,
  Trash2,
  Loader2,
  BarChart2,
} from "lucide-react";
import type { Assessment, Session, PaginationMeta } from "@/types";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
  onDelete,
  onRename,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
  onDelete: (session: Session) => void;
  onRename: (sessionId: number, newName: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(session.candidate_name || "");
  const [renaming, setRenaming] = useState(false);

  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate #${session.id}`;

  const handleSaveRename = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === session.candidate_name) {
      setEditing(false);
      return;
    }
    setRenaming(true);
    try {
      await onRename(session.id, trimmed);
      setEditing(false);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="group flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
          {index}
        </div>
        <div className="space-y-0.5 min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                disabled={renaming}
                placeholder="Candidate name..."
                className="text-xs sm:text-sm font-medium border border-input rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-56"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveRename}
                disabled={renaming}
                className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                title="Save name"
              >
                {renaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={renaming}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/name">
              <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
              <button
                type="button"
                onClick={() => {
                  setEditName(session.candidate_name || "");
                  setEditing(true);
                }}
                className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5 rounded"
                title="Edit candidate name"
                aria-label="Edit candidate name"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          {session.started_at ? (
            <div className="text-xs text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}{" "}
              {session.duration_seconds && `· ${Math.round(session.duration_seconds / 60)} min`}
            </div>
          ) : session.created_at ? (
            <div className="text-xs text-muted-foreground">
              Invited {new Date(session.created_at).toLocaleDateString()}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {isPending && (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting
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
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        )}

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
                navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)
              }
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)
              }
            >
              Results
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(session)}
            title="Delete candidate"
            aria-label="Delete candidate"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
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
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [deleteSessionLoading, setDeleteSessionLoading] = useState(false);
  const { toast } = useToast();
  usePageTitle(assessment ? assessment.name : "Assessment");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadSessions = useCallback(
    async (p: number, q: string, st: string) => {
      setSessionsLoading(true);
      try {
        const res = await assessmentsApi.getSessions(Number(id), {
          page: p,
          search: q || undefined,
          status: st || undefined,
        });
        setSessions(res.data.sessions);
        if (res.data.meta) {
          setMeta(res.data.meta);
        }
      } catch {
        // silent error for polling
      } finally {
        setSessionsLoading(false);
      }
    },
    [id]
  );

  // Initial load
  useEffect(() => {
    setLoading(true);
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        setAssessment(res.data.assessment);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Load sessions when page, search, or status change
  useEffect(() => {
    loadSessions(page, searchQuery, statusFilter);
  }, [page, searchQuery, statusFilter, loadSessions]);

  // Poll while any session on current view is live or pending
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status === "active" || s.status === "pending");
    if (!hasActive) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(() => {
      loadSessions(page, searchQuery, statusFilter);
    }, 6000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessions, page, searchQuery, statusFilter, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      toast("Invite link created successfully");
      // Reset filter to page 1 to see the newly invited session
      setPage(1);
      setSearchInput("");
      setSearchQuery("");
      setStatusFilter("");
      loadSessions(1, "", "");
    } finally {
      setCreatingSession(false);
    }
  };

  const handleRenameSession = async (sessionId: number, newName: string) => {
    try {
      await assessmentsApi.updateSession(sessionId, { candidate_name: newName });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, candidate_name: newName } : s))
      );
      toast("Candidate name updated");
    } catch {
      toast("Failed to update candidate name", "error");
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

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("");
    setPage(1);
  };

  const handleDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleteSessionLoading(true);
    try {
      await assessmentsApi.deleteSession(deletingSession.id);
      toast("Candidate session deleted");
      setDeletingSession(null);
      loadSessions(page, searchQuery, statusFilter);
    } catch {
      toast("Failed to delete candidate session", "error");
    } finally {
      setDeleteSessionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Assessments", href: "/assessments" },
          { label: assessment?.name ?? "Assessment" },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{assessment?.name ?? "—"}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              <span>{assessment?.time_limit_min} min limit</span>
              <span>·</span>
              <span className="uppercase">{assessment?.language ?? "en"}</span>
              <span>·</span>
              <span>{assessment?.skills?.length ?? 0} skills</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${id}/summary`)}
            title="View assessment summary report"
          >
            <BarChart2 className="h-3.5 w-3.5 mr-1.5" /> Summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        </div>
      </div>

      {/* Invite card */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Invite a Candidate</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a unique one-time link for your candidate to begin their AI voice interview.
            </p>
          </div>
          <Button onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-4 w-4 mr-1.5" /> Invite Candidate
          </Button>
        </CardContent>
      </Card>

      {/* Invite Candidate Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidateName">Candidate Name</Label>
              <Input
                id="candidateName"
                placeholder="e.g. John Doe (optional)"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Helping you identify the session in the candidates list.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteCandidate} disabled={creatingSession}>
              Generate Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New session created alert */}
      {newSession && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-3 px-4 space-y-2">
            <p className="text-xs font-medium text-primary">
              {newSession.candidate_name ? (
                <>
                  Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:
                </>
              ) : (
                <>New invite link ready — share with your candidate:</>
              )}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
              <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                {newSession.invite_url}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Candidates
            {meta?.total_count !== undefined && (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({meta.total_count})
              </span>
            )}
          </h2>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1">
            {[
              { label: "All", value: "" },
              { label: "Pending", value: "pending" },
              { label: "Live", value: "active" },
              { label: "Completed", value: "ended" },
            ].map((st) => (
              <button
                key={st.value}
                onClick={() => {
                  setStatusFilter(st.value);
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors",
                  statusFilter === st.value
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input for Candidates */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search candidate by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 pr-8 h-9 text-xs w-full bg-background"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              aria-label="Clear candidate search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {sessionsLoading && sessions.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          searchQuery || statusFilter ? (
            <div className="border rounded-lg p-8 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                No candidates matching your filter or search query.
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg p-10 text-center space-y-3">
              <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">No candidates yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click &ldquo;Invite Candidate&rdquo; to generate an interview link.
                </p>
              </div>
            </div>
          )
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {sessions.map((session, i) => {
                const itemIndex = meta
                  ? (meta.current_page - 1) * meta.per_page + i + 1
                  : i + 1;
                return (
                  <SessionRow
                    key={session.id}
                    session={session}
                    index={itemIndex}
                    assessmentId={id!}
                    onCopy={(sid) => {
                      const s = sessions.find((x) => x.id === sid);
                      if (s) copyLink(s, sid);
                    }}
                    copiedId={copiedId}
                    onDelete={(s) => setDeletingSession(s)}
                    onRename={handleRenameSession}
                  />
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Candidate Sessions Pagination */}
        {meta && (
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.total_pages}
            totalCount={meta.total_count}
            perPage={meta.per_page}
            onPageChange={(p) => setPage(p)}
          />
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
                  <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Delete Candidate Session Dialog */}
      <AlertDialog
        open={!!deletingSession}
        onOpenChange={(open) => !open && setDeletingSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the interview session for &ldquo;
              <strong className="text-foreground">
                {deletingSession?.candidate_name || `Candidate #${deletingSession?.id}`}
              </strong>
              &rdquo;? All transcripts, coverage evaluations, and portfolios for this candidate will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSessionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={deleteSessionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSessionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Candidate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
