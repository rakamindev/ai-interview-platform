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
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
} from "lucide-react";
import type {
  Assessment,
  Session,
  PaginationMeta,
} from "@/types";
import { sessionsApi } from "@/services/sessions";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  onDelete,
  copiedId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  onDelete: (session: Session) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
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

        <div className="flex items-center gap-1.5">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            disabled={isLive}
            title={
              isLive
                ? "Active candidate cannot be deleted"
                : "Delete candidate"
            }
            onClick={() => onDelete(session)}
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
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);

  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10,
  });

  const [sessionToDelete, setSessionToDelete] =
    useState<Session | null>(null);

  const [deletingSession, setDeletingSession] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState<string | null>(null);

  const loadSessions = useCallback(
    async (showLoading = false) => {
      if (!id) return;

      if (showLoading) {
        setSessionsLoading(true);
      }

      setSessionsError(false);

      try {
        const res = await assessmentsApi.getSessions(
          Number(id),
          page,
          debouncedSearch
        );

        setSessions(res.data.sessions);
        setMeta(res.data.meta);
      } catch {
        setSessionsError(true);
      } finally {
        if (showLoading) {
          setSessionsLoading(false);
        }
      }
    },
    [id, page, debouncedSearch]
  );

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;

    setDeletingSession(true);
    setDeleteError(null);

    try {
      await sessionsApi.delete(sessionToDelete.id);

      if (newSession?.id === sessionToDelete.id) {
        setNewSession(null);
      }

      setSessionToDelete(null);

      await loadSessions(true);
    } catch (error: any) {
      setDeleteError(
        error?.response?.data?.error ??
        error?.response?.data?.message ??
        "Failed to delete candidate."
      );
    } finally {
      setDeletingSession(false);
    }
  };

  useEffect(() => {
    loadSessions(true);
  }, [loadSessions]);

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    assessmentsApi
      .get(Number(id))
      .then((res) => {
        setAssessment(res.data.assessment);
      })
      .catch(() => { })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  // Poll while any session is live or pending
  // useEffect(() => {
  //   const hasActive = sessions.some((s) => s.status !== "ended");
  //   if (!hasActive) return;
  //   const interval = setInterval(loadSessions, 5000);
  //   return () => clearInterval(interval);
  // }, [sessions, loadSessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSessions(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadSessions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  // const handleInviteCandidate = async () => {
  //   setCreatingSession(true);
  //   setShowInviteDialog(false);
  //   setNewSession(null);
  //   try {
  //     const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
  //     const created = res.data.session;
  //     setNewSession(created);
  //     setSessions((prev) => [created, ...prev]);
  //   } finally {
  //     setCreatingSession(false);
  //   }
  // };

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

      setSearch("");
      setDebouncedSearch("");
      setPage(1);

      const sessionsRes = await assessmentsApi.getSessions(
        Number(id),
        1,
        ""
      );

      setSessions(sessionsRes.data.sessions);
      setMeta(sessionsRes.data.meta);
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

      {/* Delete session dialog */}
      <Dialog
        open={!!sessionToDelete}
        onOpenChange={(open) => {
          if (!open && !deletingSession) {
            setSessionToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete candidate?</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Candidate{" "}
              <span className="font-medium text-foreground">
                {sessionToDelete?.candidate_name || "Unnamed candidate"}
              </span>{" "}
              and the related interview session will be deleted.
            </p>

            <p className="text-xs text-muted-foreground">
              This action cannot be undone.
            </p>

            {deleteError && (
              <p className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingSession}
              onClick={() => {
                setSessionToDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={deletingSession}
              onClick={handleDeleteSession}
            >
              {deletingSession && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Candidates
            {meta.total_count > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({meta.total_count})
              </span>
            )}
          </h2>
        </div>

        {/* Search candidate */}
        <div className="relative">
          <Search
            className="
        absolute left-3 top-1/2
        -translate-y-1/2
        h-4 w-4
        text-muted-foreground
      "
          />

          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search candidates..."
            className="pl-9"
          />
        </div>

        {/* Error */}
        {sessionsError && (
          <div
            className="
        border border-destructive/40
        rounded-lg p-4
        text-sm text-destructive
      "
          >
            Failed to load candidates. Please try again.
          </div>
        )}

        {/* Loading initial/search/page */}
        {sessionsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-14 w-full"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          /* Empty state */
          debouncedSearch ? (
            <div className="border rounded-lg p-10 text-center space-y-2">
              <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />

              <div>
                <p className="text-sm font-medium">
                  No candidates found
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  No candidates match "{debouncedSearch}".
                </p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-10 text-center space-y-3">
              <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />

              <div>
                <p className="text-sm font-medium">
                  No candidates yet
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  Click "Invite Candidate" to generate an interview link.
                </p>
              </div>
            </div>
          )
        ) : (
          <>
            {/* Candidate rows */}
            <Card>
              <CardContent className="p-0 divide-y">
                {sessions.map((session, i) => {
                  const globalIndex =
                    meta.total_count -
                    (
                      (meta.current_page - 1) *
                      meta.per_page
                    ) -
                    i;

                  return (
                    <SessionRow
                      key={session.id}
                      session={session}
                      index={globalIndex}
                      assessmentId={id!}
                      onCopy={(sid) => {
                        const currentSession =
                          sessions.find(
                            (item) => item.id === sid
                          );

                        if (currentSession) {
                          copyLink(
                            currentSession,
                            sid
                          );
                        }
                      }}
                      onDelete={(session) => {
                        setDeleteError(null);
                        setSessionToDelete(session);
                      }}
                      copiedId={copiedId}
                    />
                  );
                })}
              </CardContent>
            </Card>

            {/* Pagination information */}
            {meta.total_count > 0 && (
              <div
                className="
            flex flex-col
            sm:flex-row
            sm:items-center
            justify-between
            gap-3
            pt-2
          "
              >
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  {(meta.current_page - 1) *
                    meta.per_page +
                    1}
                  {"–"}
                  {Math.min(
                    meta.current_page *
                    meta.per_page,
                    meta.total_count
                  )}{" "}
                  of {meta.total_count}
                </p>

                {meta.total_pages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        page <= 1 ||
                        sessionsLoading
                      }
                      onClick={() =>
                        setPage((current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <span
                      className="
                  text-xs
                  text-muted-foreground
                  px-2
                "
                    >
                      Page {meta.current_page} of{" "}
                      {meta.total_pages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        page >= meta.total_pages ||
                        sessionsLoading
                      }
                      onClick={() =>
                        setPage((current) =>
                          Math.min(
                            meta.total_pages,
                            current + 1
                          )
                        )
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
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
