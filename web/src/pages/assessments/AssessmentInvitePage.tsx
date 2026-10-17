import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  FileCheck2,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";
import type { Assessment, Session } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";

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
  const displayName = session.candidate_name || `Candidate #${index}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
          {session.candidate_name
            ? session.candidate_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
            : `#${index}`}
        </div>
        <div className="space-y-0.5">
          <div className="font-semibold text-sm text-foreground flex items-center gap-2">
            <span>{displayName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {session.started_at ? (
              <span>Started: {new Date(session.started_at).toLocaleDateString()}</span>
            ) : (
              <span>Invited session</span>
            )}
            {session.duration_seconds && (
              <>
                <span>•</span>
                <span>{Math.round(session.duration_seconds / 60)} mins</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2.5 self-stretch sm:self-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border/50">
        {/* Status Pill */}
        {isPending && (
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap w-full sm:w-auto text-center">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting Candidate
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap w-full sm:w-auto text-center">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Interview in Progress
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap w-full sm:w-auto text-center">
            Session Error
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap w-full sm:w-auto text-center">
            ✓ Evaluation Complete
          </span>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs w-full sm:w-auto justify-center rounded-xl font-medium"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied Link
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Copy Invite Link
                </>
              )}
            </Button>
          )}

          {isLive && (
            <Button
              size="sm"
              className="h-9 px-3.5 text-xs bg-[#01959f] hover:bg-[#01808a] text-white shadow-xs font-bold w-full sm:w-auto justify-center rounded-xl"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" /> Live Monitor
            </Button>
          )}

          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="cta"
              size="sm"
              className="h-9 px-3.5 text-xs shadow-xs font-bold w-full sm:w-auto justify-center rounded-xl"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              <FileCheck2 className="h-3.5 w-3.5 mr-1.5 shrink-0" /> View Portfolio &amp; Fit/Gap
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
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 4000);
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

  const resolveInviteUrl = (session?: Session | null) => {
    if (!session) return "";
    if (session.invite_token) {
      return `${window.location.origin}/interview/${session.invite_token}`;
    }
    return (session.invite_url || "").replace(/http:\/\/localhost:3001/, window.location.origin);
  };

  const copyLink = (session: Session, id: number) => {
    navigator.clipboard.writeText(resolveInviteUrl(session));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession) return;
    navigator.clipboard.writeText(resolveInviteUrl(newSession));
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <RakaminSpinner text="Memuat detail assessment dan sesi kandidat..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-start gap-3">
          <Link
            to="/assessments"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors mt-0.5"
            title="Kembali ke daftar assessment"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Daftar Sesi Wawancara Kandidat
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded font-medium">
                <Clock className="h-3 w-3 text-slate-500" />
                {assessment?.time_limit_min} Menit Session Ceiling
              </span>
              <span>•</span>
              <span>{assessment?.skills?.length ?? 0} Rubrik Terdaftar</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${id}/edit`)}
            className="text-xs rounded-xl"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Assessment
          </Button>
          <Button
            variant="cta"
            size="sm"
            onClick={openInviteDialog}
            disabled={creatingSession}
            className="text-xs rounded-xl shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Membuat Link..." : "Undang Kandidat"}
          </Button>
        </div>
      </div>

      {/* Hero Banner with interview illustration */}
      <HeroBanner
        badgeText="⭐️ Candidate AI Interview Hub"
        title={assessment?.name || "Undang & Kelola Sesi Kandidat"}
        highlightText="Live Session"
        subtitle="Hasilkan link undangan sesi wawancara berbasis AI, monitor percakapan live secara realtime, dan evaluasi hasil portfolio kompetensi."
        bulletPoints={[
          `Batas waktu sesi: ${assessment?.time_limit_min || 45} menit`,
          `${assessment?.skills?.length || 0} rubrik kompetensi B7 terintegrasi`,
          "Link token unik satu kali pakai (Single-use Token)",
        ]}
        imageSrc="/images/interview.png"
        imageAlt="Rakamin AI Technical Interview"
        imageFloatingBadge={{
          title: "Sesi Terproteksi",
          subtitle: "Single-use Token",
        }}
      />

      {/* Invite candidate modal */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Candidate Interview Link
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A private, single-use conversational AI session token will be created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="candidate-name" className="text-xs font-semibold uppercase tracking-wider">
              Candidate Full Name (Optional)
            </Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Budi Pratama"
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              autoFocus
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Name is securely stored and used to title the resulting portfolio dossier.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteCandidate} disabled={creatingSession}>
              Generate Link →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session banner */}
      {newSession && (
        <Card className="border-teal-200 bg-teal-50/50 shadow-xs animate-in fade-in-50 duration-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-teal-900 flex items-center gap-1.5 min-w-0">
                <LinkIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Invite Link Ready for {newSession.candidate_name || "Candidate"}</span>
              </span>
              <span className="text-xs text-teal-700 bg-teal-100 px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0">
                Single-use Token
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-teal-200 bg-white px-3 py-2 text-xs font-mono truncate text-slate-700 shadow-2xs">
                {resolveInviteUrl(newSession)}
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={copyNewSessionLink}
                className="shrink-0 text-xs"
              >
                {newSessionCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            Candidate Sessions
            {sessions.length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {sessions.length}
              </span>
            )}
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="border border-dashed border-2 rounded-xl p-10 text-center space-y-3 bg-card/40">
            <UserRound className="h-10 w-10 text-muted-foreground/60 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No candidate sessions yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Generate an invite link to allow a candidate to begin the audio interview.
              </p>
            </div>
            <Button size="sm" onClick={openInviteDialog}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Invite First Candidate
            </Button>
          </div>
        ) : (
          <Card className="shadow-xs overflow-hidden border-border/80">
            <CardContent className="p-0 divide-y divide-border/60">
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

      {/* Assessment target skills preview */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <Card className="shadow-xs border-border/80 bg-card">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Configured Competency Rubrics</CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid gap-2 sm:grid-cols-2">
            {assessment.skills.map((s) => (
              <div
                key={s.id ?? s.skill_label}
                className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between text-xs gap-2"
              >
                <span className="font-medium text-foreground truncate">{s.skill_label}</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold whitespace-nowrap shrink-0">
                  Expected {LEVEL_LABELS[s.expected_level] || `L${s.expected_level}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
