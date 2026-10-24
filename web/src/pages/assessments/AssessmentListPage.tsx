import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  Search,
  Sparkles,
  Users,
  CheckCircle2,
  Radio,
  FileCode2,
  Share2,
  Calendar
} from "lucide-react";
import type { Assessment } from "@/types";

function SessionStatusBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Belum Ada Sesi
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs animate-pulse">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Live Now
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Gagal
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200/80">
        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
        Selesai
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
      Menunggu Kandidat
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "waiting" | "active">("all");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const total = assessments.length;
    const completed = assessments.filter((a) => a.latest_session?.status === "ended" && a.latest_session.end_reason !== "error").length;
    const waiting = assessments.filter((a) => !a.latest_session || (a.latest_session.status !== "active" && a.latest_session.status !== "ended")).length;
    const active = assessments.filter((a) => a.latest_session?.status === "active").length;
    return { total, completed, waiting, active };
  }, [assessments]);

  // Filtered list
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (statusFilter === "completed") {
        return a.latest_session?.status === "ended" && a.latest_session.end_reason !== "error";
      }
      if (statusFilter === "waiting") {
        return !a.latest_session || (a.latest_session.status !== "active" && a.latest_session.status !== "ended");
      }
      if (statusFilter === "active") {
        return a.latest_session?.status === "active";
      }
      return true;
    });
  }, [assessments, searchQuery, statusFilter]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#01959f] text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Autonomous Interview Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Daftar Asesmen
          </h1>
          <p className="text-sm text-slate-500">
            Kelola instrumen wawancara AI dan pantau evaluasi kandidat secara real-time.
          </p>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="gradient-teal text-white shadow-md shadow-teal-500/20 hover:opacity-95 transition-all h-11 px-5 rounded-xl font-medium"
        >
          <Plus className="h-4 w-4 mr-2" /> Buat Asesmen Baru
        </Button>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Asesmen</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.total}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#01959f] flex items-center justify-center">
            <FileCode2 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Selesai Dinilai</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.completed}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Menunggu / Antre</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.waiting}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari asesmen berdasarkan judul role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "Semua" },
            { id: "completed", label: "Selesai" },
            { id: "waiting", label: "Menunggu" },
            { id: "active", label: "Live" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? "bg-[#01959f] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50/60 rounded-xl p-4 text-sm text-red-600">
          Gagal memuat data asesmen. Silakan refresh halaman atau coba sesaat lagi.
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-500 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 flex items-center justify-center text-[#01959f] mb-4">
            <FileCode2 className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">
            {searchQuery ? "Tidak Ditemukan Asesmen" : "Belum Ada Asesmen"}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            {searchQuery
              ? `Tidak ada asesmen yang cocok dengan pencarian "${searchQuery}". Coba kata kunci lain.`
              : "Mulai dengan membuat instrumen asesmen wawancara AI pertama Anda untuk mengevaluasi kompetensi kandidat."}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => navigate("/assessments/new")}
              className="gradient-teal text-white hover:opacity-95 rounded-xl h-10 px-5"
            >
              <Plus className="h-4 w-4 mr-2" /> Buat Asesmen Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filteredAssessments.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
              className="group relative bg-white border border-slate-200/80 hover:border-[#01959f]/50 hover:shadow-lg hover:shadow-teal-500/5 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                {/* Tech Icon Avatar */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/80 border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:from-teal-50 group-hover:to-teal-100/60 group-hover:text-[#01959f] group-hover:border-[#01959f]/20 transition-all shrink-0">
                  <FileCode2 className="h-6 w-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 group-hover:text-[#01959f] transition-colors text-base">
                      {a.name}
                    </h3>
                    <SessionStatusBadge session={a.latest_session} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {a.time_limit_min} Menit Sesi
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      ID #{a.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/assessments/${a.id}/invite`);
                  }}
                  className="rounded-xl border-slate-200 hover:border-[#01959f] hover:text-[#01959f] h-9 px-3.5 text-xs font-semibold"
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Invite Link
                </Button>

                <div className="w-9 h-9 rounded-xl bg-slate-50 group-hover:bg-[#01959f] flex items-center justify-center text-slate-400 group-hover:text-white transition-all shadow-xs">
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

