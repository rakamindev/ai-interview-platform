
import { useEffect, useState, useCallback, useMemo } from "react";
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
  X,
  Search,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionCard({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (session: Session) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const isFailed = isEnded && session.end_reason === "error";
  const isCompleted = isEnded && !isFailed;
  const displayName =
    session.candidate_name?.trim() || `Candidate ${index}`;

  const status = isPending
    ? {
        label: "Awaiting",
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
      }
    : isLive
      ? {
          label: "In progress",
          dot: "bg-blue-600",
          text: "text-blue-700 dark:text-blue-400",
        }
      : isFailed
        ? {
            label: "Failed",
            dot: "bg-destructive",
            text: "text-destructive",
          }
        : {
            label: "Completed",
            dot: "bg-emerald-600",
            text: "text-emerald-700 dark:text-emerald-400",
          };

  const date = session.started_at
    ? new Date(session.started_at).toLocaleDateString()
    : null;

  return (
    <Card className="min-w-0 shadow-none transition-colors hover:border-foreground/20">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-sm font-medium text-muted-foreground">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={displayName}>
              {displayName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {date || "Not started yet"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${status.text}`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
            />
            {status.label}
          </span>

          <span className="text-xs text-muted-foreground">#{index}</span>
        </div>

        <div className="mt-4 border-t pt-3">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full"
              onClick={() => onCopy(session)}
            >
              {copiedId === session.id ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copiedId === session.id ? "Copied" : "Copy invite link"}
            </Button>
          )}

          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full"
              onClick={() =>
                navigate(
                  `/assessments/${assessmentId}/sessions/${session.id}/monitor`,
                )
              }
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Monitor interview
            </Button>
          )}

          {isCompleted && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full"
              onClick={() =>
                navigate(
                  `/assessments/${assessmentId}/sessions/${session.id}/portfolio`,
                )
              }
            >
              View results
            </Button>
          )}

          {isFailed && (
            <p className="py-1.5 text-center text-xs text-muted-foreground">
              Session needs review
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [createError, setCreateError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadSessions = useCallback(async () => {
    if (!id) return;

    const response = await assessmentsApi.getSessions(Number(id));
    setSessions(response.data.sessions);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([assessmentResponse, sessionsResponse]) => {
        if (cancelled) return;

        setAssessment(assessmentResponse.data.assessment);
        setSessions(sessionsResponse.data.sessions);
      })
      .catch(() => {
        // Keep the page usable if the request fails.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!sessions.some((session) => session.status !== "ended")) return;

    const interval = window.setInterval(() => {
      void loadSessions().catch(() => {
        // Retain the last successful session data.
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [sessions, loadSessions]);

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    if (!query) return sessions;

    return sessions.filter((session, index) => {
      const name =
        session.candidate_name?.trim() || `Candidate ${sessions.length - index}`;

      return name.toLocaleLowerCase().includes(query);
    });
  }, [sessions, searchQuery]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setCreateError("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    if (creatingSession || !id) return;

    setCreatingSession(true);
    setCreateError("");

    try {
      const response = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined,
      );

      const created = response.data.session;

      setNewSession(created);
      setNewSessionCopied(false);
      setSessions((previous) => [
        created,
        ...previous.filter((session) => session.id !== created.id),
      ]);
      setSearchQuery("");
      setShowInviteDialog(false);
    } catch {
      setCreateError("Couldn't create the invite link. Please try again.");
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = async (session: Session) => {
    setCopyError("");

    try {
      await navigator.clipboard.writeText(session.invite_url);
      setCopiedId(session.id);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === session.id ? null : current,
        );
      }, 2000);
    } catch {
      setCopyError("Couldn't copy the link. Check clipboard permissions.");
    }
  };

  const copyNewSessionLink = async () => {
    if (!newSession?.invite_url) return;

    setCopyError("");

    try {
      await navigator.clipboard.writeText(newSession.invite_url);
      setNewSessionCopied(true);

      window.setTimeout(() => setNewSessionCopied(false), 2000);
    } catch {
      setCopyError("Couldn't copy the link. Check clipboard permissions.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-20 w-full rounded-lg" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Button variant="ghost" onClick={() => navigate("/assessments")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to assessments
        </Button>

        <p className="text-sm text-muted-foreground">
          Couldn't load this assessment. Check your connection and refresh the
          page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link to="/assessments" aria-label="Back to assessments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold tracking-tight">
              {assessment.name}
            </h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {assessment.time_limit_min} min
              </span>

              <span>{assessment.skills?.length ?? 0} skills assessed</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 pl-11 sm:pl-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${id}/edit`)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>

          <Button
            size="sm"
            onClick={openInviteDialog}
            disabled={creatingSession}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Invite candidate
          </Button>
        </div>
      </header>

      <Dialog
        open={showInviteDialog}
        onOpenChange={(open) => {
          if (creatingSession) return;

          setShowInviteDialog(open);
          if (!open) setCreateError("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite candidate</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleInviteCandidate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="candidate-name">Candidate name (optional)</Label>

              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(event) =>
                  setCandidateNameInput(event.target.value)
                }
                maxLength={120}
                autoFocus
              />

              <p className="text-xs text-muted-foreground">
                Helps you identify the session later.
              </p>
            </div>

            {createError && (
              <p role="alert" className="text-sm text-destructive">
                {createError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInviteDialog(false)}
                disabled={creatingSession}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={creatingSession}>
                {creatingSession ? "Creating..." : "Create link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {newSession && (
        <div className="rounded-lg border p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Invite link created</p>

              <p className="mt-1 text-xs text-muted-foreground">
                {newSession.candidate_name
                  ? `Share this link with ${newSession.candidate_name}.`
                  : "Share this link with your candidate."}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Dismiss invite link"
              onClick={() => setNewSession(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1 break-all rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground">
              {newSession.invite_url}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void copyNewSessionLink()}
            >
              {newSessionCopied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {newSessionCopied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      )}

      {copyError && (
        <p role="alert" className="text-xs text-destructive">
          {copyError}
        </p>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold">
            Candidates
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({sessions.length})
            </span>
          </h2>

          {sessions.length > 0 && (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search candidates..."
                aria-label="Search candidates by name"
                className="pl-9 pr-9"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <UserRound className="mx-auto h-7 w-7 text-muted-foreground" />

            <p className="mt-3 text-sm font-medium">No candidates yet</p>

            <p className="mt-1 text-xs text-muted-foreground">
              Create an invite link to get started.
            </p>

            <Button className="mt-4" size="sm" onClick={openInviteDialog}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Invite candidate
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <Search className="mx-auto h-7 w-7 text-muted-foreground" />

            <p className="mt-3 text-sm font-medium">No matching candidates</p>

            <p className="mt-1 text-xs text-muted-foreground">
              Try a different name or clear your search.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </Button>
          </div>
        ) : (
          <>
            {searchQuery.trim() && (
              <p className="text-xs text-muted-foreground">
                Showing {filteredSessions.length} of {sessions.length} candidates
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredSessions.map((session) => {
                const originalIndex = sessions.findIndex(
                  (item) => item.id === session.id,
                );

                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    index={sessions.length - originalIndex}
                    assessmentId={id!}
                    onCopy={(selected) => void copyLink(selected)}
                    copiedId={copiedId}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      {assessment.skills && assessment.skills.length > 0 && (
        <>
          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Skills assessed</h2>

            <div className="flex flex-wrap gap-2">
              {assessment.skills.map((skill) => (
                <div
                  key={skill.id ?? skill.skill_label}
                  className="rounded-md border px-3 py-2"
                >
                  <p className="text-sm font-medium">{skill.skill_label}</p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Expected: {LEVEL_LABELS[skill.expected_level]}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
