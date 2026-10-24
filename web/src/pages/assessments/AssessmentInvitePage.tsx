import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { assessmentsApi } from "@/services/assessments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Plus,
  Clock,
  UserRound,
  Sparkles,
  Award,
  Layers,
  Share2,
  Calendar,
  TrendingUp,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

const LEVEL_LABELS: Record<number, string> = {
  1: "L1 — Beginner",
  2: "L2 — Autonomous",
  3: "L3 — Complex / Senior",
  4: "L4 — Lead / Strategic",
  5: "L5 — Principal / Org Authority",
};

function StatusBadge({ session }: { session: Session }) {
  const isPending = session.status === "pending";
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Menunggu Kandidat
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs animate-pulse">
        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sesi Berlangsung (Live)
      </span>
    );
  }
  if (isEnded && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Terhenti / Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-[#01959f] border border-teal-500/20">
      <Check className="h-3 w-3" /> Wawancara Selesai
    </span>
  );
}

function CandidateCard({
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
  onDelete: (session: Session) => void;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isPending = session.status === "pending";
  const isEnded = session.status === "ended";
  const displayName = session.candidate_name || `Kandidat #${index}`;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="group bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-[#01959f]/40 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500/10 to-teal-500/20 border border-teal-500/20 text-[#01959f] flex items-center justify-center font-bold text-base shadow-xs shrink-0">
          {initial}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#01959f] transition-colors">
              {displayName}
            </h4>
            <StatusBadge session={session} />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Sesi ID #{session.id}
            </span>
            {session.started_at && (
              <span>• Dimulai {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {isPending && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(session.id)}
            className="rounded-xl border-slate-200 hover:border-[#01959f] hover:text-[#01959f] h-9 px-3.5 text-xs font-semibold"
          >
            {copiedId === session.id ? (
              <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Link Tersalin!</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1.5" /> Salin Link</>
            )}
          </Button>
        )}

        {isLive && (
          <Button
            size="sm"
            onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3.5 text-xs font-semibold shadow-xs"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Pantau Live
          </Button>
        )}

        {isEnded && session.end_reason !== "error" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            className="rounded-xl gradient-teal text-white hover:opacity-95 border-0 h-9 px-4 text-xs font-semibold shadow-xs"
          >
            <Award className="h-3.5 w-3.5 mr-1.5" /> Lihat Hasil Portfolio
          </Button>
        )}

        {isEnded && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(session)}
            className="rounded-xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 h-9 px-3 text-xs font-semibold transition-all"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
          </Button>
        )}
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([assessmentsApi.get(Number(id)), assessmentsApi.getSessions(Number(id))])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Poll while any session is active
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
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const formatInviteUrl = (rawUrl?: string) => {
    if (!rawUrl) return "";
    try {
      const parsed = new URL(rawUrl);
      return `${window.location.origin}${parsed.pathname}`;
    } catch {
      return rawUrl.startsWith("http") ? rawUrl : `${window.location.origin}${rawUrl}`;
    }
  };

  const copyLink = (sessionObj: Session, sid: number) => {
    const url = formatInviteUrl(sessionObj.invite_url);
    navigator.clipboard.writeText(url);
    setCopiedId(sid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    const url = formatInviteUrl(newSession.invite_url);
    navigator.clipboard.writeText(url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  const openDeleteDialog = (session: Session) => {
    setSessionToDelete(session);
    setShowDeleteDialog(true);
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeleting(true);
    try {
      await assessmentsApi.deleteSession(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      if (newSession?.id === sessionToDelete.id) setNewSession(null);
      setShowDeleteDialog(false);
      setSessionToDelete(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Gagal menghapus data kandidat");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pt-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#01959f] transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-[#01959f]/40 flex items-center justify-center transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span>Kembali ke Daftar Asesmen</span>
        </Link>
      </div>

      {/* Hero Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-[#004e54] text-white p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#01959f]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Instrumen Penilaian Wawancara AI</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white capitalize">
              {assessment?.name ?? "—"}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-3 py-1 rounded-full">
                <Clock className="h-3.5 w-3.5 text-teal-400" />
                {assessment?.time_limit_min} Menit Durasi Wawancara
              </span>
              <span className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-3 py-1 rounded-full">
                <Layers className="h-3.5 w-3.5 text-teal-400" />
                {assessment?.skills?.length ?? 0} Rubrik Kompetensi
              </span>
              <span className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-3 py-1 rounded-full">
                <UserRound className="h-3.5 w-3.5 text-teal-400" />
                {sessions.length} Sesi Terdaftar
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={() => navigate(`/assessments/${id}/edit`)}
              className="bg-slate-800/80 border-slate-700 text-white hover:bg-slate-800 hover:text-white rounded-xl h-11 px-4 text-xs font-semibold"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Asesmen
            </Button>
            <Button
              onClick={openInviteDialog}
              disabled={creatingSession}
              className="gradient-teal text-white hover:opacity-95 shadow-lg shadow-teal-500/25 rounded-xl h-11 px-5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" />
              {creatingSession ? "Membuat Link..." : "Undang Kandidat"}
            </Button>
          </div>
        </div>
      </div>

      {/* Newly created session alert / banner */}
      {newSession && (
        <div className="bg-teal-50 border border-teal-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-teal-900 flex items-center gap-2">
              <Share2 className="h-4 w-4 text-[#01959f]" />
              Link Wawancara untuk {newSession.candidate_name ? <span className="underline">{newSession.candidate_name}</span> : "Kandidat"} Sudah Siap!
            </p>
            <p className="text-xs text-teal-700 font-mono bg-white/80 px-3 py-1 rounded-lg border border-teal-200 inline-block">
              {formatInviteUrl(newSession.invite_url)}
            </p>
          </div>
          <Button
            onClick={copyNewSessionLink}
            className="gradient-teal text-white h-9 px-4 rounded-xl text-xs font-semibold shrink-0"
          >
            {newSessionCopied ? (
              <><Check className="h-3.5 w-3.5 mr-1.5" /> Berhasil Tersalin</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1.5" /> Salin Link Wawancara</>
            )}
          </Button>
        </div>
      )}

      {/* Two columns grid: Left = Candidates list, Right = Skills assessed rubric */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Candidates list (2 cols wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Daftar Kandidat</h2>
              <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full text-xs">
                {sessions.length}
              </span>
            </div>
            {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openInviteDialog}
                className="text-[#01959f] hover:text-[#01959f] hover:bg-teal-50 text-xs font-semibold"
              >
                + Tambah Kandidat
              </Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#01959f] flex items-center justify-center mx-auto">
                <UserRound className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Belum Ada Kandidat</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Klik tombol "Undang Kandidat" untuk menghasilkan link wawancara mandiri bagi pelamar.
              </p>
              <Button
                onClick={openInviteDialog}
                className="gradient-teal text-white rounded-xl text-xs h-9 px-4 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Undang Kandidat Pertama
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, i) => (
                <CandidateCard
                  key={session.id}
                  session={session}
                  index={sessions.length - i}
                  assessmentId={id!}
                  onCopy={(sid) => {
                    const s = sessions.find((x) => x.id === sid);
                    if (s) copyLink(s, sid);
                  }}
                  copiedId={copiedId}
                  onDelete={openDeleteDialog}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Skills Assessed Rubric (1 col wide) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Rubrik Kompetensi</h2>
            <span className="text-xs text-slate-500 font-medium">
              {assessment?.skills?.length ?? 0} Skill
            </span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 border-b border-slate-100 pb-3">
              <Award className="h-4 w-4 text-[#01959f]" />
              <span>Target evaluasi AI saat wawancara</span>
            </div>

            {assessment?.skills && assessment.skills.length > 0 ? (
              <div className="space-y-3">
                {assessment.skills.map((s, idx) => (
                  <div
                    key={s.id ?? idx}
                    className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60 hover:border-teal-500/30 transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-xs text-slate-900 leading-snug">
                        {s.skill_label}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 text-[#01959f] border border-teal-200/60 text-[11px] font-semibold">
                      <TrendingUp className="h-3 w-3" />
                      {LEVEL_LABELS[s.expected_level] || `Level ${s.expected_level}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                Belum ada rubrik kompetensi yang terpasang pada asesmen ini.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invite Candidate Modal */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 border-slate-200 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-extrabold text-slate-900">
              Undang Kandidat Baru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Masukkan nama kandidat untuk membuat tautan sesi wawancara AI yang unik.
            </p>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInviteCandidate();
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="candidate-name" className="text-xs font-semibold text-slate-700">
                Nama Lengkap Kandidat (Opsional)
              </Label>
              <Input
                id="candidate-name"
                placeholder="Contoh: Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                className="h-11 rounded-xl border-slate-200 focus:border-[#01959f]"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInviteDialog(false)}
                className="rounded-xl border-slate-200 text-xs font-semibold h-10"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="gradient-teal text-white hover:opacity-95 rounded-xl text-xs font-semibold h-10 px-5 shadow-sm"
              >
                Buat Link Wawancara
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!deleting) { setShowDeleteDialog(open); if (!open) setSessionToDelete(null); } }}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 border-slate-200 shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 text-center">
              Hapus Data Kandidat?
            </DialogTitle>
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Apakah Anda yakin ingin menghapus semua data wawancara
              {sessionToDelete?.candidate_name ? (
                <> <strong className="text-slate-700">{sessionToDelete.candidate_name}</strong></>
              ) : (
                <> <strong className="text-slate-700">Kandidat #{sessionToDelete?.id}</strong></>
              )}?
            </p>
          </DialogHeader>

          <div className="bg-red-50/80 border border-red-100 rounded-2xl p-4 space-y-2 my-2">
            <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Data yang akan dihapus permanen:
            </p>
            <ul className="text-xs text-red-700 space-y-1 pl-5 list-disc">
              <li>Seluruh transkrip percakapan wawancara</li>
              <li>Coverage map & skill mapping</li>
              <li>Portfolio hasil penilaian AI</li>
              <li>Portfolio skills & assessor overrides</li>
              <li>Fit-gap report (jika ada)</li>
            </ul>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowDeleteDialog(false); setSessionToDelete(null); }}
              disabled={deleting}
              className="rounded-xl border-slate-200 text-xs font-semibold h-10"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleDeleteSession}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-10 px-5 shadow-sm"
            >
              {deleting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Menghapus...</>
              ) : (
                <><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus Permanen</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
