import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ClipboardList,
  Layers,
  Users,
  Briefcase,
  PlayCircle,
  FileCheck2,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Assessment } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";
import { motion } from "framer-motion";

function SessionStatusBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        Belum ada sesi
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#01959f] bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#01959f] animate-ping" />
        Sesi Aktif
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        Sesi Error
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        ✓ Selesai
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
      Menunggu Kandidat
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await assessmentsApi.delete(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      setDeleteError(
        e?.response?.data?.errors?.[0]?.message ||
          "Gagal menghapus assessment. Pastikan tidak ada sesi wawancara yang sedang aktif."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Hero Banner matching Reference Image 2 */}
      <HeroBanner
        badgeText="⭐️ Rakamin AI Assessment Hub"
        title="Evaluasi Kompetensi Kandidat Berbasis AI"
        highlightText="Cepat &amp; Objektif"
        subtitle="Rancang rubric B7, undang kandidat secara otomatis, pantau sesi wawancara langsung, dan hasilkan laporan fit/gap komprehensif."
        bulletPoints={[
          "Wawancara interaktif suara & teks realtime berbasis LLM",
          "Penilaian otomatis Coverage 4-Tingkat (0%, 33%, 66%, 100%)",
          "Pematuhan penuh privasi UU PDP No. 27/2022 & Human Override",
        ]}
        primaryAction={{
          label: "Buat Assessment Baru",
          onClick: () => navigate("/assessments/new"),
          icon: <Plus className="h-4 w-4 mr-1.5" />,
        }}
        secondaryAction={{
          label: "Kelola Lowongan Role",
          onClick: () => navigate("/vacancies"),
          icon: <Briefcase className="h-4 w-4 mr-1.5" />,
        }}
        imageSrc="/images/hero-rakamin-logo.png"
        imageAlt="Rakamin AI Assessment"
        imageFloatingBadge={{
          title: "100% Objektif",
          subtitle: "UU PDP & B7 Standard",
        }}
      />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <ClipboardList className="h-6 w-6 text-[#01959f]" />
            Daftar Technical Assessments
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Konfigurasi rubrik kompetensi B7, batas waktu, dan kelola link undangan kandidat.
          </p>
        </div>
        <Button
          variant="cta"
          onClick={() => navigate("/assessments/new")}
          className="shadow-sm w-full sm:w-auto rounded-xl"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Assessment Baru
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
          <span>Gagal memuat assessment dari API. Pastikan server backend Rails berjalan di port 3001.</span>
        </div>
      )}

      {deleteError && (
        <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive font-medium flex items-center justify-between gap-2">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-xs underline text-destructive">Tutup</button>
        </div>
      )}

      {loading ? (
        <RakaminSpinner text="Memuat daftar technical assessment..." size="lg" />
      ) : assessments.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4 bg-white/60">
          <div className="w-14 h-14 rounded-2xl bg-[#01959f]/10 text-[#01959f] flex items-center justify-center mx-auto">
            <ClipboardList className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">Belum ada assessment dibuat</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Buat assessment pertama Anda untuk menentukan standar kriteria skill anchor dan mulai mengundang kandidat untuk evaluasi AI.
            </p>
          </div>
          <Button
            variant="cta"
            onClick={() => navigate("/assessments/new")}
            className="rounded-xl shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Buat Assessment Pertama
          </Button>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {assessments.map((a, idx) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
            >
              <Card
                className="group cursor-pointer hover:border-[#01959f]/50 hover:shadow-md transition-all duration-200 border-slate-200/90 bg-white rounded-2xl overflow-hidden"
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-2 flex-1 min-w-0 w-full">
                    {/* Title */}
                    <h2 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-[#01959f] transition-colors">
                      {a.name}
                    </h2>

                    {/* Metadata chips (Duration, Target Skills, Status, Pipeline) */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-semibold text-[11px] whitespace-nowrap">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        {a.time_limit_min} Menit
                      </span>

                      {a.skills && (
                        <span className="flex items-center gap-1.5 bg-teal-50 text-[#01808a] px-2.5 py-1 rounded-md font-semibold text-[11px] border border-teal-100 whitespace-nowrap">
                          <Layers className="h-3.5 w-3.5 text-[#01959f]" />
                          {a.skills.length} Target Skills
                        </span>
                      )}

                      <div className="shrink-0">
                        <SessionStatusBadge session={a.latest_session} />
                      </div>

                      <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-500 font-medium">
                        <Users className="h-3.5 w-3.5" />
                        Candidate Pipeline
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto shrink-0">

                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial rounded-xl text-xs font-bold border-slate-200 hover:bg-[#01959f]/10 hover:border-[#01959f]/50 hover:text-[#01959f] h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-4 flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <PlayCircle className="h-4 w-4 text-[#01959f]" />
                      <span>Kelola Sesi</span>
                    </Button>

                    {/* Delete dialog */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          title="Hapus Assessment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl" onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-lg font-bold text-slate-900">
                            Hapus Assessment &quot;{a.name}&quot;?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-sm text-slate-600">
                            Tindakan ini tidak dapat dibatalkan. Assessment dan rubrik yang terkait akan dihapus secara permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4 gap-2">
                          <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            className="bg-destructive hover:bg-destructive/90 text-white font-semibold rounded-xl"
                          >
                            {deletingId === a.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
