import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  ChevronRight,
  Search,
  Sparkles,
  Layers,
  Award,
  Calendar,
  Building2,
  Pencil,
} from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) =>
      v.role_title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vacancies, searchQuery]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#01959f] text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Role & Competency Management</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Daftar Lowongan (Vacancies)
          </h1>
          <p className="text-sm text-slate-500">
            Kelola profil jabatan, standar ekspektasi kompetensi, dan kultur tim untuk evaluasi fit-gap AI.
          </p>
        </div>
        <Button
          onClick={() => navigate("/vacancies/new")}
          className="gradient-teal text-white shadow-md shadow-teal-500/20 hover:opacity-95 transition-all h-11 px-5 rounded-xl font-medium"
        >
          <Plus className="h-4 w-4 mr-2" /> Buat Lowongan Baru
        </Button>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Lowongan</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? "..." : vacancies.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#01959f] flex items-center justify-center">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rubrik Terpetakan</p>
            <p className="text-2xl font-bold text-slate-900">
              {loading
                ? "..."
                : vacancies.reduce((acc, v) => acc + (v.skills?.length ?? 0), 0)} Skill
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fit-Gap Engine</p>
            <p className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Siap Evaluasi
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari lowongan berdasarkan nama role jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50/60 rounded-xl p-4 text-sm text-red-600">
          Gagal memuat data lowongan. Silakan refresh halaman atau coba sesaat lagi.
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : filteredVacancies.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-500 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 flex items-center justify-center text-[#01959f] mb-4">
            <Briefcase className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">
            {searchQuery ? "Tidak Ditemukan Lowongan" : "Belum Ada Lowongan"}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            {searchQuery
              ? `Tidak ada lowongan yang cocok dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
              : "Buat profil lowongan pertama untuk menentukan target skill dan kultur tim yang akan dinilai oleh AI."}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => navigate("/vacancies/new")}
              className="gradient-teal text-white hover:opacity-95 rounded-xl h-10 px-5"
            >
              <Plus className="h-4 w-4 mr-2" /> Buat Lowongan Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filteredVacancies.map((v) => (
            <div
              key={v.id}
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              className="group bg-white border border-slate-200/80 hover:border-[#01959f]/50 hover:shadow-lg hover:shadow-teal-500/5 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/80 border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:from-teal-50 group-hover:to-teal-100/60 group-hover:text-[#01959f] group-hover:border-[#01959f]/20 transition-all shrink-0">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 group-hover:text-[#01959f] transition-colors text-base">
                      {v.role_title}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/80">
                      <Layers className="h-3 w-3" />
                      {v.skills?.length ?? 0} Skill Ekspektasi
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      ID #{v.id}
                    </span>
                    {v.culture_dimensions && (
                      <span className="truncate max-w-xs text-slate-500 hidden md:inline">
                        • Kultur: {v.culture_dimensions}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/vacancies/${v.id}/edit`);
                  }}
                  className="rounded-xl border-slate-200 hover:border-[#01959f] hover:text-[#01959f] h-9 px-3.5 text-xs font-semibold"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Role
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
