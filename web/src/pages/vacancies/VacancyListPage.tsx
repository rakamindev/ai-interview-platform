import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, FileText, CheckCircle2, AlertCircle, Building2, Search, Trash2 } from "lucide-react";
import type { Vacancy } from "@/types";
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

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchVacancies = () => {
    setLoading(true);
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      await vacanciesApi.delete(id);
      fetchVacancies();
    } catch (err) {
      console.error("Failed to delete vacancy", err);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchVacancies();
  }, []);

  const total = vacancies.length;

  const filteredVacancies = useMemo(() => {
    if (!searchQuery.trim()) return vacancies;
    const q = searchQuery.toLowerCase();
    return vacancies.filter((v) => 
      v.role_title.toLowerCase().includes(q) || 
      v.id.toString().toLowerCase().includes(q)
    );
  }, [vacancies, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar Lowongan Pekerjaan</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola posisi pekerjaan yang tersedia untuk assessment kandidat.</p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")} size="lg" className="shadow-sm transition-transform active:scale-95 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Buat Lowongan Baru
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Lowongan Aktif</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assessment Selesai Terkait</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className="text-muted-foreground text-sm font-normal italic">Informasi belum tersedia</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-4 text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          Gagal memuat data lowongan. Silakan muat ulang halaman.
        </div>
      )}

      {/* Grid of Vacancies */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Semua Lowongan</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari lowongan..."
              className="pl-9 bg-background focus-visible:ring-primary h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : vacancies.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center bg-muted/20">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Belum Ada Lowongan</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">Anda belum menambahkan posisi pekerjaan apa pun. Tambahkan lowongan untuk dihubungkan dengan assessment.</p>
            <Button onClick={() => navigate("/vacancies/new")} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Tambah Lowongan Pertama
            </Button>
          </div>
        ) : filteredVacancies.length === 0 ? (
           <div className="border border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center bg-muted/5">
            <Search className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">Tidak ditemukan</h3>
            <p className="text-sm text-muted-foreground">Tidak ada lowongan yang cocok dengan pencarian "{searchQuery}".</p>
            <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-primary">Bersihkan pencarian</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVacancies.map((v) => (
              <Card
                key={v.id}
                className="group cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col overflow-hidden"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <div className="h-1 w-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <CardHeader className="pb-3 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-background text-xs font-medium text-muted-foreground border-muted-foreground/30">ID: {v.id.toString().substring(0, 8)}</Badge>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">Tersedia</Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                            onClick={(e) => e.stopPropagation()}
                            disabled={deletingId === v.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tindakan ini tidak dapat dibatalkan. Lowongan pekerjaan <strong>{v.role_title}</strong> beserta seluruh laporan kesesuaian kultur (Fit/Gap Report) yang terhubung akan dihapus secara permanen dari server.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(v.id);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deletingId === v.id ? "Menghapus..." : "Ya, Hapus"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">{v.role_title}</CardTitle>
                  <CardDescription className="flex items-center mt-2 text-xs">
                    <Building2 className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                    Divisi/Departemen belum diatur
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-3 border-t bg-muted/30 group-hover:bg-primary/5 transition-colors text-sm font-medium text-primary flex justify-between">
                  <span>Lihat Detail</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
