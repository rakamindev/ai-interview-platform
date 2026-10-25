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
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
  onDelete,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
  onDelete: (id: number) => void;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isFailed = session.status === "failed" || (session.status === "ended" && session.end_reason === "error");
  const isEnded = session.status === "ended" && !isFailed;
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
          <span role="status" className="flex items-center gap-1 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting candidate
          </span>
        )}
        {isLive && (
          <span role="status" className="flex items-center gap-1 text-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
        {isFailed && (
          <span role="status" className="flex items-center gap-1 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span role="status" className="flex items-center gap-1 text-xs text-green-600">
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
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(session.id)}
              aria-label={`Delete ${displayName} invite`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              aria-label={`Monitor ${displayName}`}
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
              aria-label={`View results for ${displayName}`}
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
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "active" | "pending" | "failed">("all");
  const [candidatePage, setCandidatePage] = useState(1);
  const CANDIDATES_PER_PAGE = 8;

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
    if (assessment?.archived_at) {
      window.alert("Candidate invitations are only available for unarchived assessments. Unarchive this assessment first.");
      return;
    }
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    if (assessment?.archived_at) {
      window.alert("Candidate invitations are only available for unarchived assessments. Unarchive this assessment first.");
      return;
    }
    setCreatingSession(true);
    setShowInviteDialog(false);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
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

  const deleteSession = async (sessionId: number) => {
    if (!window.confirm("Delete this pending candidate invite? This cannot be undone.")) return;

    try {
      await assessmentsApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    } catch {
      // The API interceptor handles authorization failures; keep the invite visible
      // for retry when deletion fails for another reason.
    }
  };

  const filteredSessions = useMemo(() => {
    const normalizedSearch = candidateSearch.trim().toLowerCase();
    return sessions.filter((session) => {
      const matchesSearch = !normalizedSearch || (session.candidate_name || "").toLowerCase().includes(normalizedSearch);
      const completed = session.status === "ended" && session.end_reason !== "error";
      const failed = session.status === "failed" || (session.status === "ended" && session.end_reason === "error");
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "completed" && completed)
        || (statusFilter === "failed" && failed)
        || (statusFilter === session.status);
      return matchesSearch && matchesStatus;
    });
  }, [candidateSearch, sessions, statusFilter]);

  const candidateTotalPages = Math.max(1, Math.ceil(filteredSessions.length / CANDIDATES_PER_PAGE));
  const visibleSessions = filteredSessions.slice(
    (candidatePage - 1) * CANDIDATES_PER_PAGE,
    candidatePage * CANDIDATES_PER_PAGE
  );
  const statusCounts = {
    all: sessions.length,
    pending: sessions.filter((session) => session.status === "pending").length,
    active: sessions.filter((session) => session.status === "active").length,
    completed: sessions.filter((session) => session.status === "ended" && session.end_reason !== "error").length,
    failed: sessions.filter((session) => session.status === "failed" || (session.status === "ended" && session.end_reason === "error")).length,
  };

  const updateCandidateSearch = (value: string) => {
    setCandidateSearch(value);
    setCandidatePage(1);
  };

  const updateStatusFilter = (value: "all" | "completed" | "active" | "pending" | "failed") => {
    setStatusFilter(value);
    setCandidatePage(1);
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
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Link to="/assessments" aria-label="Back to assessments" className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
          <Button
            size="sm"
            onClick={openInviteDialog}
            disabled={creatingSession || !!assessment?.archived_at}
            title={assessment?.archived_at ? "Only available for unarchived assessments" : undefined}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {assessment?.archived_at && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Candidate invitations are only available for unarchived assessments. Unarchive this assessment before creating a new invite.
        </div>
      )}

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

      <Separator />

      {/* Sessions list */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Candidates <span className="font-normal text-muted-foreground">({sessions.length})</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">Track invite status and candidate results.</p>
          </div>
        </div>

        {sessions.length > 0 && <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search candidates" placeholder="Search candidates..." value={candidateSearch} onChange={(event) => updateCandidateSearch(event.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Candidate status filter">
            {(["all", "completed", "active", "pending", "failed"] as const).map((status) => <Button key={status} size="sm" variant={statusFilter === status ? "secondary" : "ghost"} aria-pressed={statusFilter === status} onClick={() => updateStatusFilter(status)}>{status === "all" ? "All" : status === "completed" ? "Completed" : status === "active" ? "Live" : status === "pending" ? "Pending" : "Failed"} ({statusCounts[status]})</Button>)}
          </div>
        </div>}

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
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No candidates match the current search or filter.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {visibleSessions.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  index={filteredSessions.length - ((candidatePage - 1) * CANDIDATES_PER_PAGE + i)}
                  assessmentId={id!}
                  onCopy={(sid) => {
                    const s = sessions.find((x) => x.id === sid);
                    if (s) copyLink(s, sid);
                  }}
                  copiedId={copiedId}
                  onDelete={deleteSession}
                />
              ))}
            </CardContent>
          </Card>
        )}
        {sessions.length > 0 && filteredSessions.length > 0 && candidateTotalPages > 1 && <nav className="flex items-center justify-between border-t pt-3" aria-label="Candidate pagination"><p className="text-xs text-muted-foreground">Page {candidatePage} of {candidateTotalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={candidatePage <= 1} onClick={() => setCandidatePage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={candidatePage >= candidateTotalPages} onClick={() => setCandidatePage((current) => current + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></nav>}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="lg:col-start-2">
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">Skills assessed</h2>
                <p className="text-xs text-muted-foreground mt-1">Expected competency levels</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Skill</th>
                      <th className="text-right px-4 py-2 font-medium">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.skills.map((skill) => (
                      <tr key={skill.id ?? skill.skill_label} className="border-b last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground">{skill.skill_label}</td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {LEVEL_LABELS[skill.expected_level]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
