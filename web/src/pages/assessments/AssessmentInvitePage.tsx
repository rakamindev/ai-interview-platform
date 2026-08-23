import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import { Copy, Check, Eye, Pencil, Plus, UserRound } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId
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
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/40 transition-colors">
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
            {m.assessment_awaiting_candidate()}
          </span>
        )}
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {m.assessment_live()}
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            {m.assessment_failed()}
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {m.assessment_completed()}
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
                  <Check className="h-3 w-3 mr-1" /> {m.assessment_copied()}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" /> {m.assessment_copy_link()}
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
              <Eye className="h-3 w-3 mr-1" /> {m.assessment_monitor()}
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
              {m.assessment_results()}
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
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([assessmentsApi.get(Number(id)), assessmentsApi.getSessions(Number(id))])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
        return;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      toast.success(
        created.candidate_name
          ? m.assessment_invite_created_for({ name: created.candidate_name })
          : m.assessment_invite_created()
      );
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, copyId: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(copyId);
    toast.success(m.common_link_copied());
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    toast.success(m.common_link_copied());
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
    <main className="max-w-2xl mx-auto">
      <PageHeader
        title={assessment?.name ?? "—"}
        backTo="/assessments"
        backLabel={m.common_back_to_assessments()}
        description={        `${assessment?.time_limit_min ?? 0}${m.assessment_minutes_suffix()} · ${assessment?.skills?.length ?? 0} skills`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> {m.assessment_edit_link()}
            </Button>
            <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {creatingSession ? m.assessment_creating() : m.assessment_invite_candidate()}
            </Button>
          </>
        }
      />
      <div className="space-y-6">
        {/* Invite candidate dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{m.assessment_invite_candidate()}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="candidate-name">{m.assessment_candidate_name()}</Label>
              <Input
                id="candidate-name"
                placeholder={m.assessment_candidate_name_placeholder()}
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              />
              <p className="text-xs text-muted-foreground">
                {m.assessment_candidate_name_hint_long()}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                {m.assessment_cancel()}
              </Button>
              <Button onClick={handleInviteCandidate}>{m.assessment_create_link()}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Newly created session invite link */}
        {newSession && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm font-medium">
                {newSession.candidate_name ? (
                  m.assessment_link_ready_named({ name: newSession.candidate_name })
                ) : (
                  m.assessment_link_ready()
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
                    <Check className="h-3.5 w-3.5 mr-1.5" /> {m.assessment_copied()}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> {m.assessment_copy_link()}
                  </>
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
              {m.assessment_candidates()}
              {sessions.length > 0 && (
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({sessions.length})
                </span>
              )}
            </h2>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={m.assessment_no_candidates()}
              description={m.assessment_no_candidates_description()}
              actionLabel={m.assessment_invite_candidate()}
              onAction={openInviteDialog}
            />
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
              <h2 className="text-sm font-semibold">{m.assessment_skills_assessed()}</h2>
              <ul className="space-y-1">
                {assessment.skills.map((s) => (
                  <li
                    key={s.id ?? s.skill_label}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span>•</span>
                    <span>{s.skill_label}</span>
                    <span className="text-xs">({m.assessment_expected()} {LEVEL_LABELS[s.expected_level]})</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
