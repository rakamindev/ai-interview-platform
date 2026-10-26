import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, AlertCircle, Sparkles, ArrowRight } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-emerald-500/15">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm mb-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Job Positions & Vacancies</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Daftar Lowongan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola lowongan pekerjaan yang akan dihubungkan dengan modul evaluasi wawancara.
          </p>
        </div>

        <button
          onClick={() => navigate("/vacancies/new")}
          className="self-start sm:self-auto flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-[0_4px_25px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all border border-emerald-400/40 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Lowongan Baru</span>
        </button>
      </div>

      {error && (
        <div className="border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-800 bg-rose-50/80 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>Gagal memuat daftar lowongan. Silakan muat ulang halaman.</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-white/70 border border-emerald-500/10 p-6 space-y-3 animate-pulse shadow-sm" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-white/90 backdrop-blur-xl p-16 text-center space-y-5 shadow-sm max-w-lg mx-auto">
          <div className="h-16 w-16 rounded-3xl bg-emerald-50 border border-emerald-300 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
            <Briefcase className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">Belum Ada Lowongan</h3>
            <p className="text-xs text-slate-500">
              Buat lowongan pekerjaan untuk menentukan target kompetensi kandidat yang dicari.
            </p>
          </div>
          <button
            onClick={() => navigate("/vacancies/new")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-500 shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Buat Lowongan Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vacancies.map((v) => (
            <div
              key={v.id}
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              className="group relative rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 flex flex-col justify-between cursor-pointer hover:border-emerald-400/60 hover:shadow-[0_20px_45px_-12px_rgba(16,185,129,0.18)] hover:-translate-y-1.5 transition-all overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 opacity-80 group-hover:opacity-100 transition-opacity" />

              <div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {v.role_title}
                </h2>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Target kompetensi dan deskripsi kualifikasi lowongan.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-emerald-100/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 group-hover:text-emerald-600 flex items-center gap-1.5">
                  Edit Lowongan <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
