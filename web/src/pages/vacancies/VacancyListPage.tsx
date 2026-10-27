import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  ChevronRight,
  Search,
  Sparkles,
  Award,
  Layers,
  Building2,
  AlertCircle
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
      .then((res) => setVacancies(res.data.vacancies || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredVacancies = useMemo(() => {
    if (!searchQuery.trim()) return vacancies;
    const q = searchQuery.toLowerCase();
    return vacancies.filter(
      (v) =>
        v.role_title.toLowerCase().includes(q) ||
        v.culture_dimensions?.toLowerCase().includes(q) ||
        v.competency_expectations?.toLowerCase().includes(q)
    );
  }, [vacancies, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vacancies
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Definisikan profil jabatan, ekspektasi kompetensi, dan dimensi kultur untuk analisis Fit/Gap.
          </p>
        </div>
        <Button
          onClick={() => navigate("/vacancies/new")}
          className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-sm h-10 px-4 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Buat Vacancy Baru
        </Button>
      </div>

      {/* KPI Stats Overview Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 rounded-xl text-teal-700">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Lowongan Terbuka</div>
            <div className="text-xl font-bold text-slate-900">{vacancies.length} Roles</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Standar Level</div>
            <div className="text-xl font-bold text-slate-900">B7 Taxonomy (L1–L5)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Fit/Gap Engine</div>
            <div className="text-xs font-bold text-slate-800">Spider Radar Integration</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari lowongan berdasarkan nama jabatan atau dimensi kompetensi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-white rounded-xl border-slate-200 text-sm focus-visible:ring-teal-600 shadow-2xs"
        />
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50/80 rounded-xl p-3.5 text-sm text-red-700 flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>Gagal memuat daftar vacancies. Silakan muat ulang halaman.</span>
        </div>
      )}

      {/* Vacancy Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredVacancies.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white shadow-2xs space-y-4">
          <div className="mx-auto w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center">
            <Briefcase className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-slate-900">Belum ada vacancy</h3>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `Tidak ada lowongan yang sesuai dengan "${searchQuery}".`
                : "Definisikan lowongan kerja untuk membandingkan kecocokan skill kandidat pada radar chart."}
            </p>
          </div>
          <Button onClick={() => navigate("/vacancies/new")} className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Buat Vacancy Baru
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVacancies.map((v) => (
            <Card
              key={v.id}
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white hover:border-teal-500/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              <CardContent className="p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 bg-slate-100 rounded-xl text-teal-700 group-hover:bg-teal-50 transition-colors">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    ID #{v.id}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition-colors">
                    {v.role_title}
                  </h3>
                  {v.culture_dimensions && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {v.culture_dimensions}
                    </p>
                  )}
                </div>

                {v.competency_expectations && (
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 line-clamp-2">
                    <strong className="text-slate-700 font-semibold">Ekspektasi: </strong>
                    {v.competency_expectations}
                  </div>
                )}
              </CardContent>

              <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-teal-700 group-hover:underline">
                  Edit Role &amp; Skills
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
