import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  AlertCircle,
  Layers,
  Sparkles,
  Radio,
  CheckCircle2,
  Users,
  Search,
  ArrowRight,
  Edit,
  Globe,
  Hourglass,
  Code2,
  Briefcase,
  Terminal,
} from "lucide-react";
import type { Assessment } from "@/types";

// Helper to pick a contextual icon based on assessment name
function getRoleIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("front") || lower.includes("back") || lower.includes("engineer") || lower.includes("dev") || lower.includes("software")) {
    return <Code2 className="h-5 w-5 text-emerald-600" />;
  }
  if (lower.includes("account") || lower.includes("finance") || lower.includes("tax") || lower.includes("audit")) {
    return <Briefcase className="h-5 w-5 text-teal-600" />;
  }
  return <Terminal className="h-5 w-5 text-emerald-600" />;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "ended">("all");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Filtered assessment list
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const liveCount = a.candidate_stats?.live ?? (a.latest_session?.status === "active" ? 1 : 0);
      const completedCount = a.candidate_stats?.completed ?? (a.latest_session?.status === "ended" ? 1 : 0);

      if (filterStatus === "active") return liveCount > 0;
      if (filterStatus === "ended") return completedCount > 0;
      return true;
    });
  }, [assessments, searchQuery, filterStatus]);

  // Global Statistics
  const globalStats = useMemo(() => {
    const total = assessments.length;
    const totalLive = assessments.reduce(
      (acc, a) => acc + (a.candidate_stats?.live ?? (a.latest_session?.status === "active" ? 1 : 0)),
      0
    );
    const totalCompleted = assessments.reduce(
      (acc, a) => acc + (a.candidate_stats?.completed ?? (a.latest_session?.status === "ended" ? 1 : 0)),
      0
    );
    const totalWaiting = assessments.reduce(
      (acc, a) => acc + (a.candidate_stats?.waiting ?? (a.latest_session?.status === "pending" ? 1 : 0)),
      0
    );

    return { total, totalLive, totalCompleted, totalWaiting };
  }, [assessments]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── Top Hero & Action Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-emerald-500/15">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm mb-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>AI Autonomous Interviewer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Daftar Assessment
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau status kandidat secara real-time dan kelola posisi wawancara cerdas.
          </p>
        </div>

        <button
          onClick={() => navigate("/assessments/new")}
          className="self-start md:self-auto flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-[0_4px_25px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all border border-emerald-400/40 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Assessment Baru</span>
        </button>
      </div>

      {/* ── Minimalist Metric Stat Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Positions */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] relative overflow-hidden group hover:border-emerald-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Posisi</span>
            <div className="h-9 w-9 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:scale-105 transition-transform">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{globalStats.total}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Assessment terdaftar</p>
          </div>
        </div>

        {/* Live Active */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] relative overflow-hidden group hover:border-emerald-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Sedang Live</span>
            <div className="h-9 w-9 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
              <Radio className="h-4 w-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-bold text-emerald-700">{globalStats.totalLive}</div>
            {globalStats.totalLive > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
                Live Now
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Kandidat dalam sesi aktif</p>
        </div>

        {/* Completed */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] relative overflow-hidden group hover:border-emerald-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Telah Selesai</span>
            <div className="h-9 w-9 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{globalStats.totalCompleted}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Kandidat tuntas dievaluasi</p>
          </div>
        </div>

        {/* Waiting */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] relative overflow-hidden group hover:border-emerald-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Menunggu Tes</span>
            <div className="h-9 w-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
              <Hourglass className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{globalStats.totalWaiting}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Undangan belum dikerjakan</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Ribbon ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari posisi atau nama assessment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterStatus === "all"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterStatus === "active"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            Sedang Live
          </button>
          <button
            onClick={() => setFilterStatus("ended")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterStatus === "ended"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            Selesai
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-800 bg-rose-50 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>Gagal memuat daftar assessment. Silakan muat ulang halaman.</span>
        </div>
      )}

      {/* ── Content Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-white border border-slate-200/80 p-6 space-y-4 animate-pulse shadow-sm"
            >
              <div className="flex justify-between items-center">
                <div className="h-6 w-28 bg-slate-200 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="h-7 w-3/4 bg-slate-200 rounded-xl" />
              <div className="h-16 w-full bg-slate-100 rounded-2xl" />
              <div className="h-10 w-full bg-slate-200 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-14 text-center space-y-4 shadow-sm max-w-md mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
            <Layers className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery ? "Tidak Ada Hasil" : "Belum Ada Assessment"}
            </h3>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `Tidak ditemukan posisi yang cocok dengan kata kunci "${searchQuery}".`
                : "Mulai buat posisi asesmen pertama Anda untuk menguji kandidat."}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => navigate("/assessments/new")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-500 shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Buat Assessment
            </button>
          )}
        </div>
      ) : (
        /* ── Modern, Minimalist & Animated Cards Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssessments.map((a) => {
            const stats = a.candidate_stats || {
              completed: a.latest_session?.status === "ended" ? 1 : 0,
              live: a.latest_session?.status === "active" ? 1 : 0,
              waiting: a.latest_session?.status === "pending" ? 1 : 0,
              total: a.latest_session ? 1 : 0,
            };

            const isCurrentlyLive = stats.live > 0;

            return (
              <div
                key={a.id}
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
                className="group relative rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_22px_45px_-12px_rgba(16,185,129,0.18)] hover:border-emerald-400 overflow-hidden"
              >
                {/* Ambient Hover Glow */}
                <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-400/15 to-emerald-600/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl pointer-events-none" />

                {/* Top Glowing Shimmer Line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 opacity-80 group-hover:opacity-100 transition-opacity" />

                <div>
                  {/* Header Row: Role Icon, Meta Tags & Live Status */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-100/70 transition-all duration-300">
                        {getRoleIcon(a.name)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100/80 border border-slate-200/70 px-2.5 py-1 rounded-full">
                          <Clock className="h-3 w-3 text-emerald-600" />
                          {a.time_limit_min}m
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100/80 border border-slate-200/70 px-2 py-1 rounded-full uppercase">
                          <Globe className="h-3 w-3 text-slate-400" />
                          {a.language || "en"}
                        </span>
                      </div>
                    </div>

                    {isCurrentlyLive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm animate-pulse">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {stats.live} Live
                      </span>
                    )}
                  </div>

                  {/* Role Title */}
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors duration-200 capitalize leading-snug line-clamp-1">
                    {a.name}
                  </h2>

                  {/* ── Modern Telemetry Capsule Dock (Selesai, Live, Waiting) ── */}
                  <div className="mt-4 p-2 rounded-2xl bg-gradient-to-r from-slate-50 via-emerald-50/20 to-slate-50 border border-slate-200/70 grid grid-cols-3 divide-x divide-slate-200/70 shadow-inner">
                    {/* Selesai */}
                    <div className="px-2 py-1 flex flex-col items-center justify-center text-center">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                        <CheckCircle2 className="h-3 w-3 text-teal-600 shrink-0" />
                        <span>Selesai</span>
                      </div>
                      <span className="text-base font-extrabold text-slate-900 mt-0.5 group-hover:text-teal-700 transition-colors">
                        {stats.completed}
                      </span>
                      <span className="text-[9px] text-slate-400">kandidat</span>
                    </div>

                    {/* Live */}
                    <div
                      className={`px-2 py-1 flex flex-col items-center justify-center text-center transition-all ${
                        stats.live > 0 ? "bg-emerald-100/60 rounded-xl" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-tight">
                        {stats.live > 0 ? (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                        )}
                        <span className={stats.live > 0 ? "text-emerald-700 font-bold" : "text-slate-500"}>
                          Live
                        </span>
                      </div>
                      <span
                        className={`text-base font-extrabold mt-0.5 ${
                          stats.live > 0 ? "text-emerald-700 font-black animate-pulse" : "text-slate-900"
                        }`}
                      >
                        {stats.live}
                      </span>
                      <span className={stats.live > 0 ? "text-[9px] text-emerald-600 font-bold" : "text-[9px] text-slate-400"}>
                        sedang tes
                      </span>
                    </div>

                    {/* Waiting */}
                    <div className="px-2 py-1 flex flex-col items-center justify-center text-center">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                        <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>Waiting</span>
                      </div>
                      <span className="text-base font-extrabold text-slate-900 mt-0.5 group-hover:text-amber-700 transition-colors">
                        {stats.waiting}
                      </span>
                      <span className="text-[9px] text-slate-400">menunggu</span>
                    </div>
                  </div>

                  {/* Skills Minimalist Tag Pill */}
                  {a.skills && a.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {a.skills.slice(0, 3).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-medium bg-emerald-50/60 border border-emerald-200/60 text-emerald-800 group-hover:border-emerald-300 transition-colors"
                        >
                          {s.skill_label}
                        </span>
                      ))}
                      {a.skills.length > 3 && (
                        <span className="px-2 py-1 rounded-xl text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200/60">
                          +{a.skills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Modern Action Footer with Micro-interactions ── */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 group-hover:text-emerald-700 transition-colors duration-200">
                    <span>Kelola Kandidat</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1.5 transition-transform duration-300 text-emerald-600" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Edit Assessment"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/assessments/${a.id}/edit`);
                      }}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-8 w-8 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-teal-600 group-hover:text-white group-hover:border-emerald-500 group-hover:scale-105 group-hover:shadow-sm transition-all duration-300">
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
