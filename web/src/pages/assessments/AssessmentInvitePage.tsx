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
  FileText,
  Radio,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Share2,
  ShieldCheck,
  Radar
} from "lucide-react";
import type { Assessment, Session } from "@/types";

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
    setSessions(res.data.sessions || []);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions || []);
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
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );
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
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link to="/assessments" className="hover:text-teal-700 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Assessments</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{assessment?.name ?? "Assessment Detail"}</span>
      </div>

      {/* Assessment Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-500" /> {assessment?.time_limit_min} Menit
              </span>
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full">
                {assessment?.language === "id" ? "Bahasa Indonesia" : "English"}
              </span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> UU PDP Compliant
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {assessment?.name}
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Template wawancara suara live dengan evaluasi multi-kompetensi otomatis menggunakan Gemini Enterprise AI.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/assessments/${id}/edit`)}
              className="rounded-xl border-slate-200 text-xs h-9 bg-white"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Template
            </Button>
            <Button
              size="sm"
              onClick={openInviteDialog}
              disabled={creatingSession}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-9 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {creatingSession ? "Membuat link..." : "Undang Kandidat"}
            </Button>
          </div>
        </div>

        {/* Skills Tag Cloud */}
        {assessment?.skills && assessment.skills.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kompetensi yang Dinilai ({assessment.skills.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {assessment.skills.map((s) => (
                <div
                  key={s.id ?? s.skill_label}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"
                >
                  <span className="font-semibold text-slate-800">{s.skill_label}</span>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded-md">
                    {LEVEL_LABELS[s.expected_level]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Newly Created Session Banner */}
      {newSession && (
        <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>
              {newSession.candidate_name ? (
                <>Invite Link untuk <strong>{newSession.candidate_name}</strong> berhasil dibuat!</>
              ) : (
                <>Invite Link sesi baru siap dibagikan ke kandidat:</>
              )}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 bg-white border border-emerald-200 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-700 truncate select-all shadow-2xs">
              {newSession.invite_url}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={copyNewSessionLink}
                className="bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-300 rounded-xl text-xs h-9"
              >
                {newSessionCopied ? (
                  <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Tersalin!</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1.5" /> Salin Link</>
                )}
              </Button>
              <a
                href={newSession.invite_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-3 h-9 rounded-xl text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Buka Tab Baru
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Sessions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Sesi Kandidat
            </h2>
            <p className="text-xs text-slate-500">
              Pantau status wawancara, transkrip real-time, dan laporan portfolio hasil penilaian.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
            {sessions.length} Sesi Terdaftar
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white space-y-3 shadow-2xs">
            <UserRound className="h-10 w-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900 text-sm">Belum ada kandidat</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Klik tombol "Undang Kandidat" untuk menghasilkan tautan wawancara khusus kandidat.
              </p>
            </div>
            <Button onClick={openInviteDialog} className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Tautan Pertama
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {sessions.map((session, i) => {
              const isLive = session.status === "active";
              const isEnded = session.status === "ended";
              const isPending = session.status === "pending";
              const isFailed = isEnded && session.end_reason === "error";
              const displayName = session.candidate_name || `Kandidat #${sessions.length - i}`;

              return (
                <div
                  key={session.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {sessions.length - i}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {displayName}
                        </span>
                        {/* Status Badge */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Menunggu Kandidat
                          </span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Wawancara Berlangsung
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Sesi Selesai (Interrupted)
                          </span>
                        )}
                        {isEnded && !isFailed && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3 text-teal-600" />
                            Selesai Dievaluasi
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                        {session.invite_url}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {isPending && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-slate-200 text-xs h-8 bg-white"
                        onClick={() => copyLink(session, session.id)}
                      >
                        {copiedId === session.id ? (
                          <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Tersalin</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1.5" /> Salin Link</>
                        )}
                      </Button>
                    )}

                    {isLive && (
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs h-8 shadow-xs"
                        onClick={() => navigate(`/assessments/${id}/sessions/${session.id}/monitor`)}
                      >
                        <Radio className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> Live Cockpit
                      </Button>
                    )}

                    {isEnded && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-slate-200 text-xs h-8 bg-white"
                          onClick={() => navigate(`/assessments/${id}/sessions/${session.id}/transcript`)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Transkrip
                        </Button>
                        <Button
                          size="sm"
                          className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-8 shadow-xs"
                          onClick={() => navigate(`/assessments/${id}/sessions/${session.id}/portfolio`)}
                        >
                          <Radar className="h-3.5 w-3.5 mr-1.5" /> Hasil &amp; Radar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Candidate Modal Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-slate-900">Undang Kandidat Baru</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Buat tautan undangan khusus untuk kandidat mengikuti sesi wawancara AI ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name" className="text-xs font-semibold text-slate-700">
                Nama Lengkap Kandidat
              </Label>
              <Input
                id="candidate-name"
                placeholder="Contoh: Kang Wisman Nur"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                className="rounded-xl border-slate-200 h-10 text-sm focus-visible:ring-teal-600"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                Opsional — nama akan tampil pada transkrip dan kartu evaluasi portfolio.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowInviteDialog(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button onClick={handleInviteCandidate} className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs">
              Generate Invite Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
