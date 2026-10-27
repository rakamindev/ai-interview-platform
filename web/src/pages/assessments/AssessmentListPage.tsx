import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Edit2,
  AlertCircle,
  Search,
  Users,
  Radio,
  FileCheck2,
  Sparkles,
  Link as LinkIcon,
  Globe2
} from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchAssessments = (pageToFetch: number) => {
    setLoading(true);
    setError(null);
    assessmentsApi
      .list(pageToFetch)
      .then((res) => {
        setAssessments(res.data.assessments || []);
        if (res.data.meta) {
          setMeta(res.data.meta);
        }
      })
      .catch(() => setError("Gagal memuat daftar assessment. Silakan muat ulang halaman."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssessments(page);
  }, [page]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm("Apakah Anda yakin ingin menghapus assessment ini?")) return;

    setDeletingId(id);
    try {
      await assessmentsApi.delete(id);
      fetchAssessments(page);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        "Assessment tidak dapat dihapus karena sudah memiliki riwayat sesi interview.";
      setError(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered by search
  const filteredAssessments = useMemo(() => {
    if (!searchQuery.trim()) return assessments;
    const q = searchQuery.toLowerCase();
    return assessments.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.skills?.some((s) => s.skill_label.toLowerCase().includes(q))
    );
  }, [assessments, searchQuery]);

  // Executive KPI summary calculations
  const totalCount = meta?.total_count ?? assessments.length;
  const activeSessionsCount = assessments.filter(
    (a) => a.latest_session?.status === "active"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Assessments
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola template wawancara AI, target kompetensi, dan invite link kandidat.
          </p>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-sm h-10 px-4 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Buat Assessment Baru
        </Button>
      </div>

      {/* KPI Stats Overview Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 rounded-xl text-teal-700">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Assessments</div>
            <div className="text-xl font-bold text-slate-900">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Live Session Sekarang</div>
            <div className="text-xl font-bold text-emerald-700">{activeSessionsCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Standar Durasi</div>
            <div className="text-xl font-bold text-slate-900">30 - 60 Min</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Evaluasi Model</div>
            <div className="text-xs font-bold text-slate-800">Gemini 3.8 Flash</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari assessment berdasarkan nama posisi atau target skill..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-white rounded-xl border-slate-200 text-sm focus-visible:ring-teal-600 shadow-2xs"
        />
      </div>

      {/* Error alert */}
      {error && (
        <div className="border border-red-200 bg-red-50/80 rounded-xl p-3.5 text-sm text-red-700 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-7 text-xs">
            Tutup
          </Button>
        </div>
      )}

      {/* Assessments Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white shadow-2xs space-y-4">
          <div className="mx-auto w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-slate-900">Belum ada assessment</h3>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `Tidak ada assessment yang cocok dengan "${searchQuery}".`
                : "Mulai buat template wawancara AI pertama untuk posisi yang sedang dibuka."}
            </p>
          </div>
          <Button onClick={() => navigate("/assessments/new")} className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Buat Assessment Baru
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssessments.map((a) => {
            const isLive = a.latest_session?.status === "active";
            const sessionCount = a.sessions_count ?? (a.latest_session ? 1 : 0);

            return (
              <Card
                key={a.id}
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
                className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white hover:border-teal-500/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {a.time_limit_min} Min
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-full">
                        <Globe2 className="h-3 w-3 text-teal-600" />
                        {a.language === "id" ? "Bahasa Indonesia" : "English"}
                      </span>
                    </div>

                    {isLive && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Live now
                      </span>
                    )}
                    {!isLive && a.latest_session?.status === "ended" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        Last: {a.latest_session.end_reason ?? "completed"}
                      </span>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                      {a.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{sessionCount} kandidat terdaftar</span>
                    </p>
                  </div>

                  {/* Target Skills Tags */}
                  {a.skills && a.skills.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Kompetensi Target ({a.skills.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {a.skills.slice(0, 3).map((s) => (
                          <span
                            key={s.id}
                            className="text-[11px] bg-slate-50 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-lg font-medium"
                          >
                            {s.skill_label}
                          </span>
                        ))}
                        {a.skills.length > 3 && (
                          <span className="text-[11px] text-slate-400 font-medium self-center pl-0.5">
                            +{a.skills.length - 3} lainnya
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-500">
                    <LinkIcon className="h-3 w-3 text-slate-400" />
                    <span>Invite &amp; Monitor</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg"
                      onClick={() => navigate(`/assessments/${a.id}/edit`)}
                      title="Edit Assessment"
                      aria-label="Edit Assessment"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      disabled={deletingId === a.id}
                      onClick={(e) => handleDelete(e, a.id)}
                      title="Delete Assessment"
                      aria-label="Delete Assessment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ml-1" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Showing Page {meta.current_page} of {meta.total_pages} ({meta.total_count} total)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl h-8 px-2.5 text-xs bg-white"
              aria-label="Previous"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl h-8 px-2.5 text-xs bg-white"
              aria-label="Next"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
