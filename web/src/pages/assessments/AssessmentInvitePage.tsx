import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
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
import { Alert } from "@/components/ui/alert";
import { extractApiError } from "@/lib/apiErrors";
import { toast } from "@/stores/toastStore";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment, Session } from "@/types";
import { assessmentKeys } from "@/lib/queryKeys";

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

  return (
    <div className="flex flex-col gap-2 py-3 px-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
          {index}
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-medium truncate">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </div>
    </div>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const assessmentId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Local RHF form for the invite dialog (UI enhancement: one form pattern
  // across the app — Login, Signup, and this dialog all use react-hook-form).
  const inviteForm = useForm<{ candidateName: string }>({
    defaultValues: { candidateName: "" },
    mode: "onTouched",
  });
  const { register: registerInvite, formState: inviteState } = inviteForm;

  const assessmentQuery = useQuery({
    queryKey: assessmentKeys.detail(assessmentId),
    queryFn: async () => (await assessmentsApi.get(assessmentId)).data.assessment,
  });
  const sessionsQuery = useQuery({
    queryKey: assessmentKeys.sessions(assessmentId),
    queryFn: async () => (await assessmentsApi.getSessions(assessmentId)).data.sessions,
    refetchInterval: (query) =>
      query.state.data?.some((session) => session.status !== "ended") ? 5_000 : false,
  });
  const assessment: Assessment | null = assessmentQuery.data ?? null;
  const sessions: Session[] = sessionsQuery.data ?? [];

  const createSessionMutation = useMutation({
    mutationFn: (candidateName?: string) =>
      assessmentsApi.createSession(assessmentId, candidateName),
    onSuccess: (response) => {
      const created = response.data.session;
      queryClient.setQueryData<Session[]>(assessmentKeys.sessions(assessmentId), (current = []) => [
        created,
        ...current,
      ]);
      setNewSession(created);
      setShowInviteDialog(false);
      toast.success("Invite link created", "Share the link with your candidate.");
    },
    onError: (error) => setInviteError(extractApiError(error).message),
  });

  const openInviteDialog = () => {
    inviteForm.reset({ candidateName: "" });
    setInviteError(null);
    setShowInviteDialog(true);
  };

  // NEW-F-01 fix: the dialog stays open until the API call succeeds. On
  // failure an inline error is shown inside the dialog instead of silently
  // closing it and leaving the assessor with no feedback.
  const handleInviteCandidate = async (data: { candidateName: string }) => {
    setInviteError(null);
    setNewSession(null);
    createSessionMutation.mutate(data.candidateName.trim() || undefined);
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

  const loading = assessmentQuery.isPending || sessionsQuery.isPending;
  const loadError = assessmentQuery.error ?? sessionsQuery.error;

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
      {/* Load failure banner with retry (F-26) */}
      {loadError && (
        <Alert className="items-center">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">Couldn't load this assessment: {extractApiError(loadError).message}</p>
            <Button
              variant="outline"
              size="sm"
              
              className="shrink-0"
              onClick={() => void Promise.all([assessmentQuery.refetch(), sessionsQuery.refetch()])}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
          <Button size="sm" onClick={openInviteDialog} disabled={createSessionMutation.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {createSessionMutation.isPending ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <form
            onSubmit={inviteForm.handleSubmit(handleInviteCandidate)}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>Invite Candidate</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="candidate-name">Candidate name</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                autoFocus
                disabled={createSessionMutation.isPending}
                aria-invalid={inviteState.errors.candidateName ? true : undefined}
                className={cn(
                  inviteState.errors.candidateName &&
                    "border-destructive focus-visible:ring-destructive/40"
                )}
                {...registerInvite("candidateName", {
                  validate: (v) =>
                    v && !v.trim() ? "Candidate name can't be only spaces." : undefined,
                })}
              />
              {inviteState.errors.candidateName && (
                <p className="text-xs text-destructive" role="alert">
                  {inviteState.errors.candidateName.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Optional — helps you identify this session later.</p>
              {inviteError && (
                <Alert>
                  <p className="text-sm">Couldn't create the invite: {inviteError}</p>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)} disabled={createSessionMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={createSessionMutation.isPending}>
                {createSessionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Link
              </Button>
            </DialogFooter>
          </form>
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
