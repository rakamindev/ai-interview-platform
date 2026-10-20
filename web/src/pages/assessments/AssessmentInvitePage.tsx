import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import { LEVEL_LABELS, LEVEL_BADGE_SOLID } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { Copy, Check, Eye, Pencil, Clock, Plus, UserRound } from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionStatus({ session }: { session: Session }) {
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Awaiting candidate
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live
      </span>
    );
  }
  if (isEnded && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  if (isEnded && session.end_reason !== "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Completed
      </span>
    );
  }
  return null;
}

function SessionAction({
  session,
  assessmentId,
  onCopy,
  copiedId,
}: {
  session: Session;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";

  return (
    <div className="flex items-center justify-end">
      {isPending && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => onCopy(session.id)}
        >
          {copiedId === session.id ? (
            <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5 mr-1" /> Copy link</>
          )}
        </Button>
      )}
      {isLive && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> Monitor
        </Button>
      )}
      {isEnded && session.end_reason !== "error" && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
        >
          Results
        </Button>
      )}
    </div>
  );
}

function SessionTableRow({
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
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <TableRow>
      <TableCell className="w-14 text-center text-sm font-medium text-muted-foreground">
        {index}
      </TableCell>
      <TableCell className="font-medium text-foreground">
        {displayName}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {session.started_at ? new Date(session.started_at).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell>
        <SessionStatus session={session} />
      </TableCell>
      <TableCell className="text-right">
        <SessionAction
          session={session}
          assessmentId={assessmentId}
          onCopy={onCopy}
          copiedId={copiedId}
        />
      </TableCell>
    </TableRow>
  );
}

function SessionCardItem({
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
        <SessionStatus session={session} />
        <SessionAction
          session={session}
          assessmentId={assessmentId}
          onCopy={onCopy}
          copiedId={copiedId}
        />
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

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => a.id - b.id);
  }, [sessions]);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch(() => {}).finally(() => setLoading(false));
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
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{assessment?.name ?? "—"}</h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{assessment?.time_limit_min} min · {assessment?.skills?.length ?? 0} skills assessed</span>
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

      <Separator />

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
            {/* Mobile & Tablet card view */}
            <Card className="lg:hidden rounded-none">
              <CardContent className="p-0 divide-y">
                {sortedSessions.map((session, i) => (
                  <SessionCardItem
                    key={session.id}
                    session={session}
                    index={i + 1}
                    assessmentId={id!}
                    onCopy={(sid) => {
                      const s = sortedSessions.find((x) => x.id === sid);
                      if (s) copyLink(s, sid);
                    }}
                    copiedId={copiedId}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Desktop table view */}
            <div className="hidden lg:block bg-card overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[6%] text-center">#</TableHead>
                    <TableHead className="w-[34%]">Name</TableHead>
                    <TableHead className="w-[20%]">Interview Date</TableHead>
                    <TableHead className="w-[24%]">Status</TableHead>
                    <TableHead className="w-[16%] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSessions.map((session, i) => (
                    <SessionTableRow
                      key={session.id}
                      session={session}
                      index={i + 1}
                      assessmentId={id!}
                      onCopy={(sid) => {
                        const s = sortedSessions.find((x) => x.id === sid);
                        if (s) copyLink(s, sid);
                      }}
                      copiedId={copiedId}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">
            Skills assessed
            <span className="ml-1.5 text-muted-foreground font-normal">
              ({assessment.skills.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {assessment.skills.map((s) => (
              <Card key={s.id ?? s.skill_label} className="rounded-none">
                <CardContent className="p-3.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate" title={s.skill_label}>
                    {s.skill_label}
                  </span>
                  <Badge
                    className={cn(
                      "text-xs font-medium border-0 shrink-0",
                      LEVEL_BADGE_SOLID[s.expected_level] || "bg-slate-500 text-white"
                    )}
                  >
                    Expected {LEVEL_LABELS[s.expected_level]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
