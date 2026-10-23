import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search, Building } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredVacancies = useMemo(() => {
    if (!search.trim()) return vacancies;
    return vacancies.filter((v) =>
      (v.role_title || (v as any).title || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [vacancies, search]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Daftar Lowongan Pekerjaan</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {vacancies.length} Posisi
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Kelola standar kualifikasi posisi dan kriteria penilaian untuk analisis Fit/Gap kandidat.
          </p>
        </div>

        <Button
          onClick={() => navigate("/vacancies/new")}
          className="rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Tambah Lowongan
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari judul posisi lowongan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl bg-card border-border shadow-sm text-sm"
        />
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/10 rounded-2xl p-4 text-sm text-destructive">
          Gagal memuat data lowongan. Silakan muat ulang halaman.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl bg-muted/60" />)}
        </div>
      ) : filteredVacancies.length === 0 ? (
        <div className="border border-dashed border-border rounded-3xl p-12 text-center space-y-4 bg-card/40">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {search ? "Tidak ada lowongan yang cocok dengan pencarian" : "Belum ada lowongan yang terdaftar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {search
                ? "Coba kata kunci lain atau bersihkan kotak pencarian."
                : "Buat posisi lowongan untuk mulai mencocokkan hasil wawancara kandidat dengan kualifikasi pekerjaan."}
            </p>
          </div>
          {!search && (
            <Button
              variant="outline"
              onClick={() => navigate("/vacancies/new")}
              className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Buat Lowongan Baru
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredVacancies.map((v) => (
            <Card
              key={v.id}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {v.role_title || (v as any).title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Klik untuk mengedit kualifikasi dan standar level kompetensi.
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
