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
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Mail } from "lucide-react";
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
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {index}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {session.candidate_email && (
              <span className="flex items-center font-mono">
                <Mail className="h-3 w-3 mr-1 text-slate-400" />
                {session.candidate_email}
              </span>
            )}
            {session.started_at && (
              <span>· {new Date(session.started_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>


      <div className="flex items-center gap-3">
        {isPending && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Awaiting Candidate
          </span>
        )}
        {isLive && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Live Now
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            Session Ended
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-2">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1" /> Copy link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold bg-teal-50/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/40"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1 text-teal-600" /> Monitor Live
            </Button>
          )}
          {isEnded && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-700 dark:hover:text-teal-300 hover:border-teal-300 shadow-2xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              View Results
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
  const [candidateEmailInput, setCandidateEmailInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

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
    setCandidateEmailInput("");
    setInviteError(null);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    const name = candidateNameInput.trim();
    const email = candidateEmailInput.trim();

    if (!name) {
      setInviteError("Nama kandidat wajib diisi.");
      return;
    }
    if (!email) {
      setInviteError("Email kandidat wajib diisi.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setInviteError("Format email kandidat tidak valid.");
      return;
    }

    setCreatingSession(true);
    setInviteError(null);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), name, email);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Gagal membuat sesi undang kandidat.";
      setInviteError(msg);
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
      <div className="w-full space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Undang Kandidat Asesmen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {inviteError && (
              <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 rounded-md border border-rose-200 dark:border-rose-800">
                {inviteError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nama Lengkap Kandidat <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="candidate-name"
                placeholder="Contoh: Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => {
                  setCandidateNameInput(e.target.value);
                  if (inviteError) setInviteError(null);
                }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidate-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Kandidat <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="candidate-email"
                type="email"
                placeholder="Contoh: budi.santoso@example.com"
                value={candidateEmailInput}
                onChange={(e) => {
                  setCandidateEmailInput(e.target.value);
                  if (inviteError) setInviteError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              />
              <p className="text-[11px] text-muted-foreground">
                Nama & email kandidat akan tersimpan untuk memudahkan proses seleksi dan rekap evaluasi portofolio.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Batal</Button>
            <Button
              onClick={handleInviteCandidate}
              disabled={creatingSession || !candidateNameInput.trim() || !candidateEmailInput.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {creatingSession ? "Membuat..." : "Buat Link Undangan"}
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
