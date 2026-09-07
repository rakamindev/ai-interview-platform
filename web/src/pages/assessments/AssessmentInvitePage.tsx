import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
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
  Radio,
  CheckCircle2,
  Users,
  Target,
  ExternalLink,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

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
  const displayName = session.candidate_name || `Candidate #${session.id}`;

  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-slate-900">{displayName}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span>Session #{session.id}</span>
              {session.started_at && (
                <>
                  <span>·</span>
                  <span>{new Date(session.started_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5 text-center">
        {isPending && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Awaiting Candidate
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Live Interview
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            Terminated (Error)
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Completed
          </span>
        )}
      </td>

      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs bg-white"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Copy Link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Monitor Live
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs bg-white font-medium text-slate-700 hover:text-slate-900"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              Portfolio Results <ExternalLink className="h-3 w-3 ml-1 text-slate-400" />
            </Button>
          )}
        </div>
      </td>
    </tr>
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

  const stats = useMemo(() => {
    const total = sessions.length;
    const live = sessions.filter((s) => s.status === "active").length;
    const completed = sessions.filter((s) => s.status === "ended" && s.end_reason !== "error").length;
    const pending = sessions.filter((s) => s.status === "pending").length;
    return { total, live, completed, pending };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    return sessions.filter((s) => {
      const name = s.candidate_name || `Candidate #${s.id}`;
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [sessions, search]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/assessments"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{assessment?.name ?? "—"}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                {assessment?.time_limit_min} minutes time limit
              </span>
              <span>·</span>
              <span>{assessment?.skills?.length ?? 0} assessed competencies</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium bg-white"
            onClick={() => navigate(`/assessments/${id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Edit Blueprint
          </Button>
          <Button
            size="sm"
            onClick={openInviteDialog}
            disabled={creatingSession}
            className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Candidates</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Live Now</p>
              <p className="text-xl font-bold text-slate-900">
                {stats.live} <span className="text-xs font-normal text-slate-500">interviews</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Completed</p>
              <p className="text-xl font-bold text-slate-900">
                {stats.completed} <span className="text-xs font-normal text-slate-500">evaluated</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-none bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Awaiting Start</p>
              <p className="text-xl font-bold text-slate-900">
                {stats.pending} <span className="text-xs font-normal text-slate-500">invited</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Candidate Interview Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name" className="text-xs font-medium">Candidate full name</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Pratama"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
                className="text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Personalized links allow tracking candidate identity and auto-generating portfolio results upon conclusion.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleInviteCandidate}>
              Create Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link */}
      {newSession && (
        <Card className="border border-emerald-200 bg-emerald-50/50 shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-900">
                {newSession.candidate_name
                  ? <>Interview link generated for <span className="underline">{newSession.candidate_name}</span>:</>
                  : <>New interview session link ready:</>}
              </p>
              <span className="text-[11px] text-emerald-700 font-medium">Session #{newSession.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 border border-emerald-200 rounded-md px-3 py-2 bg-white text-xs font-mono text-slate-700 truncate">
                {newSession.invite_url}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyNewSessionLink}
                className="h-9 text-xs bg-white shrink-0 border-emerald-200 hover:bg-emerald-50"
              >
                {newSessionCopied ? (
                  <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Copied!</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1.5 text-slate-600" /> Copy Link</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions list */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Candidate Interview Sessions
            </h2>
            <span className="text-xs text-slate-500">({filteredSessions.length})</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search candidate by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white border-slate-200"
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="border border-slate-200 bg-white rounded-lg p-10 text-center space-y-3">
            <UserRound className="h-8 w-8 text-slate-400 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {search ? "No matching candidates found" : "No candidate interviews scheduled"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {search ? "Try refining your search filter." : 'Click "Invite Candidate" above to generate a unique interview session link.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs text-slate-600 uppercase tracking-wider font-semibold">
                  <th className="text-left px-4 py-3">Candidate & Session</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session, i) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    index={filteredSessions.length - i}
                    assessmentId={id!}
                    onCopy={(sid) => {
                      const s = sessions.find((x) => x.id === sid);
                      if (s) copyLink(s, sid);
                    }}
                    copiedId={copiedId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <Card className="border border-slate-200 shadow-none bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Assessment Competencies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {assessment.skills.map((s) => (
                  <div
                    key={s.id ?? s.skill_label}
                    className="p-3 rounded-md bg-slate-50 border border-slate-200/70 flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{s.skill_label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Target: {LEVEL_LABELS[s.expected_level]} ({LEVEL_DESCRIPTIONS[s.expected_level]})
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {LEVEL_LABELS[s.expected_level]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
