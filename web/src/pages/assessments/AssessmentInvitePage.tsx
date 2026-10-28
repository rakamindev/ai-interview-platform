import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Users,
  UserRound,
  CircleCheck,
  CircleAlert,
  Timer,
  Code2,
  RefreshCw,
  ArrowUpRight,
  ClipboardList,
  Search,
  X,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

function formatDate(date?: string | null) {
  if (!date) return "Belum dimulai";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSessionState(session: Session) {
  if (session.status === "pending") {
    return {
      label: "Menunggu",
      dot: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  if (session.status === "active") {
    return {
      label: "Sedang wawancara",
      dot: "bg-teal-500 animate-pulse",
      badge: "bg-teal-50 text-teal-700 ring-teal-200",
    };
  }

  if (session.end_reason === "error") {
    return {
      label: "Gagal",
      dot: "bg-red-500",
      badge: "bg-red-50 text-red-700 ring-red-200",
    };
  }

  return {
    label: "Selesai",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
}

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
  const state = getSessionState(session);
  const displayName = session.candidate_name?.trim() || `Kandidat ${index}`;

  return (
    <div className="group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm">
          {displayName.trim().charAt(0).toUpperCase() || (
            <UserRound className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {displayName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(session.started_at)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${state.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
          {state.label}
        </span>

        {session.status === "pending" && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-slate-200 bg-white"
            onClick={() => onCopy(session.id)}
          >
            {copiedId === session.id ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copiedId === session.id ? "Tersalin" : "Salin tautan"}
          </Button>
        )}

        {session.status === "active" && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-slate-200 bg-white"
            onClick={() =>
              navigate(
                `/assessments/${assessmentId}/sessions/${session.id}/monitor`
              )
            }
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Pantau
          </Button>
        )}

        {session.status === "ended" && session.end_reason !== "error" && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-slate-200 bg-white"
            onClick={() =>
              navigate(
                `/assessments/${assessmentId}/sessions/${session.id}/portfolio`
              )
            }
          >
            Lihat hasil
            <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
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
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadSessions = useCallback(async () => {
    if (!id) return;

    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setLoadError(false);

      try {
        const [assessmentRes, sessionsRes] = await Promise.all([
          assessmentsApi.get(Number(id)),
          assessmentsApi.getSessions(Number(id)),
        ]);

        if (cancelled) return;

        setAssessment(assessmentRes.data.assessment);
        setSessions(sessionsRes.data.sessions);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Perbarui status kandidat secara otomatis selama wawancara belum selesai.
  useEffect(() => {
    const hasUnfinishedSessions = sessions.some(
      (session) => session.status !== "ended"
    );

    if (!hasUnfinishedSessions) return;

    const interval = setInterval(() => {
      void loadSessions().catch(() => {
        // Data yang sudah tampil tetap dipertahankan jika refresh gagal.
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setActionError("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    if (!id || creatingSession) return;

    setActionError("");
    setCopyError("");
    setCreatingSession(true);
    setNewSession(null);

    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );

      const created = res.data.session;

      setNewSession(created);
      setSessions((previous) => [
        created,
        ...previous.filter((session) => session.id !== created.id),
      ]);
      setSearchQuery("");
      setShowInviteDialog(false);
    } catch {
      setActionError(
        "Tautan undangan gagal dibuat. Periksa koneksi internet lalu coba lagi."
      );
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = async (session: Session, sessionId: number) => {
    setCopyError("");

    try {
      await navigator.clipboard.writeText(session.invite_url);
      setCopiedId(sessionId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopyError(
        "Tautan undangan gagal disalin. Periksa izin browser lalu coba lagi."
      );
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
      setCopyError(
        "Tautan undangan gagal disalin. Periksa izin browser lalu coba lagi."
      );
    }
  };

  if (loading) {
    return (
      <div
        className="mx-auto max-w-5xl space-y-6"
        aria-label="Memuat asesmen"
      >
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError || !assessment) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card className="rounded-2xl border-red-200 shadow-sm">
          <CardContent className="flex flex-col items-center p-8 text-center sm:p-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <CircleAlert className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              Gagal memuat asesmen
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Detail asesmen atau daftar kandidat belum dapat dimuat.
              Periksa koneksi internet lalu coba lagi.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-[#01959f] text-white hover:bg-[#017f87]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Coba lagi
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/assessments")}
              className="mt-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke asesmen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = sessions.filter(
    (session) => session.status === "ended" && session.end_reason !== "error"
  ).length;

  const activeCount = sessions.filter(
    (session) => session.status === "active"
  ).length;

  const pendingCount = sessions.filter(
    (session) => session.status === "pending"
  ).length;

  const failedCount = sessions.filter(
    (session) => session.status === "ended" && session.end_reason === "error"
  ).length;

  const stats = [
    {
      label: "Total kandidat",
      value: sessions.length,
      icon: Users,
      iconClass: "bg-slate-100 text-slate-600",
      description: "Semua kandidat yang diundang",
    },
    {
      label: "Selesai",
      value: completedCount,
      icon: CircleCheck,
      iconClass: "bg-emerald-50 text-emerald-700",
      description: "Wawancara telah selesai",
    },
    {
      label: "Sedang berlangsung",
      value: activeCount,
      icon: Timer,
      iconClass: "bg-teal-50 text-teal-700",
      description: "Kandidat sedang diwawancarai",
    },
    {
      label: "Menunggu",
      value: pendingCount,
      icon: Clock,
      iconClass: "bg-amber-50 text-amber-700",
      description: "Belum memulai wawancara",
    },
  ];

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("id-ID");

  const filteredSessions = sessions.filter((session) =>
    (session.candidate_name?.trim() || "")
      .toLocaleLowerCase("id-ID")
      .includes(normalizedQuery)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-10">
      <Link
        to="/assessments"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Semua asesmen
      </Link>

      {/* Ringkasan asesmen */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 bg-[#01959f]" />
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#01959f]">
              <ClipboardList className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                  Asesmen
                </span>
                <span className="text-xs text-slate-400">
                  ID #{assessment.id}
                </span>
              </div>

              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {assessment.name}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Kelola undangan kandidat, pantau proses wawancara, dan tinjau
                hasil penilaian.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {assessment.time_limit_min} menit
                </span>
                <span className="inline-flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  {assessment.skills?.length ?? 0} skill dinilai
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {sessions.length} kandidat
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Button
              variant="outline"
              className="h-10 rounded-xl border-slate-200"
              onClick={() => navigate(`/assessments/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit asesmen
            </Button>
            <Button
              className="h-10 rounded-xl bg-[#01959f] text-white hover:bg-[#017f87]"
              onClick={openInviteDialog}
              disabled={creatingSession}
            >
              <Plus className="mr-2 h-4 w-4" />
              Undang kandidat
            </Button>
          </div>
        </div>
      </section>

      {/* Dialog undang kandidat */}
      <Dialog
        open={showInviteDialog}
        onOpenChange={(open) => {
          if (!creatingSession) setShowInviteDialog(open);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Undang kandidat
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <Label htmlFor="candidate-name">Nama kandidat</Label>
            <Input
              id="candidate-name"
              placeholder="Contoh: Budi Santoso"
              value={candidateNameInput}
              onChange={(event) => setCandidateNameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !creatingSession) {
                  event.preventDefault();
                  void handleInviteCandidate();
                }
              }}
              autoFocus
              className="h-11 rounded-xl"
            />
            <p className="text-xs leading-5 text-slate-500">
              Opsional. Nama membantu Anda mengenali kandidat dengan lebih
              mudah.
            </p>

            {actionError && (
              <p role="alert" className="text-sm text-red-600">
                {actionError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowInviteDialog(false)}
              disabled={creatingSession}
            >
              Batal
            </Button>
            <Button
              className="rounded-xl bg-[#01959f] text-white hover:bg-[#017f87]"
              onClick={() => void handleInviteCandidate()}
              disabled={creatingSession}
            >
              {creatingSession ? "Membuat tautan..." : "Buat tautan undangan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tautan undangan yang baru dibuat */}
      {newSession && (
        <Card className="overflow-hidden rounded-2xl border-teal-200 bg-teal-50/60 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
                <CircleCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">
                  Tautan undangan berhasil dibuat
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {newSession.candidate_name
                    ? `Siap dibagikan kepada ${newSession.candidate_name}.`
                    : "Tautan wawancara kandidat siap dibagikan."}
                </p>
                <p className="mt-2 max-w-xl truncate rounded-lg border border-teal-100 bg-white px-3 py-2 font-mono text-xs text-slate-500">
                  {newSession.invite_url}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="shrink-0 rounded-xl border-teal-200 bg-white"
              onClick={() => void copyNewSessionLink()}
            >
              {newSessionCopied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {newSessionCopied ? "Tersalin" : "Salin tautan"}
            </Button>
          </CardContent>
        </Card>
      )}

      {copyError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {copyError}
        </p>
      )}

      {/* Ringkasan status kandidat */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Ringkasan Kandidat
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ringkasan status undangan dan wawancara kandidat.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <Card
                key={stat.label}
                className="rounded-2xl border-slate-200 shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {stat.label}
                      </p>
                      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {failedCount > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {failedCount} wawancara berakhir karena terjadi kesalahan.
          </p>
        )}
      </section>

      {/* Daftar kandidat */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Daftar Kandidat
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kelola wawancara dan buka hasil penilaian kandidat yang telah
                selesai.
              </p>
            </div>

            <span className="w-fit shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {sessions.length} kandidat
            </span>
          </div>

          {sessions.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama kandidat..."
                  aria-label="Cari berdasarkan nama kandidat"
                  className="h-11 rounded-xl border-slate-200 pl-9 pr-10 focus-visible:ring-[#01959f]"
                />

                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-slate-400 transition-colors hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <p className="shrink-0 text-xs text-slate-500 sm:text-right">
                {searchQuery.trim()
                  ? `${filteredSessions.length} dari ${sessions.length} kandidat`
                  : "Cari berdasarkan nama"}
              </p>
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <UserRound className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Belum ada kandidat
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Buat tautan undangan untuk memulai. Anda dapat membagikan tautan
              tersebut langsung kepada kandidat.
            </p>
            <Button
              className="mt-5 rounded-xl bg-[#01959f] text-white hover:bg-[#017f87]"
              onClick={openInviteDialog}
            >
              <Plus className="mr-2 h-4 w-4" />
              Undang kandidat pertama
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Kandidat tidak ditemukan
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Tidak ada nama kandidat yang cocok dengan pencarian Anda.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => setSearchQuery("")}
            >
              Hapus pencarian
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 bg-slate-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span>Kandidat</span>
              <span>Status</span>
              <span className="text-right">Aksi</span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredSessions.map((session) => {
                const originalIndex = sessions.findIndex(
                  (item) => item.id === session.id
                );

                return (
                  <SessionRow
                    key={session.id}
                    session={session}
                    index={sessions.length - originalIndex}
                    assessmentId={id!}
                    onCopy={(sessionId) => {
                      const selectedSession = sessions.find(
                        (item) => item.id === sessionId
                      );

                      if (selectedSession) {
                        void copyLink(selectedSession, sessionId);
                      }
                    }}
                    copiedId={copiedId}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Skill yang dinilai */}
      {assessment.skills && assessment.skills.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Skill yang Dinilai
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Kompetensi yang dievaluasi selama wawancara beserta level
              kemampuan yang diharapkan.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assessment.skills.map((skill) => (
              <Card
                key={skill.id ?? skill.skill_label}
                className="rounded-2xl border-slate-200 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="flex h-full items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#01959f]">
                    <Code2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-6 text-slate-900">
                      {skill.skill_label}
                    </p>
                    <span className="mt-3 inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      Target: {LEVEL_LABELS[skill.expected_level]}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}