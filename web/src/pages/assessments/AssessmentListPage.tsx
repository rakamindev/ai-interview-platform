import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, Users, Activity, FileText, CheckCircle2, AlertCircle, Search, Trash2 } from "lucide-react";
import type { Assessment } from "@/types";
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

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <Badge variant="secondary" className="bg-muted text-muted-foreground border-transparent">Menunggu Kandidat</Badge>;

  if (session.status === "active")
    return (
      <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
        Live Now
      </Badge>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent">
        <AlertCircle className="w-3 h-3 mr-1" /> Gagal
      </Badge>
    );

  if (session.status === "ended")
    return (
      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Selesai
      </Badge>
    );

  return <Badge variant="secondary">Menunggu Kandidat</Badge>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchAssessments = () => {
    setLoading(true);
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      await assessmentsApi.delete(id);
      // Refresh the list after successful deletion
      fetchAssessments();
    } catch (err) {
      console.error("Failed to delete assessment", err);
      // Optionally show a toast error here
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  // Calculate simple stats
  const total = assessments.length;
  const active = assessments.filter(a => a.latest_session?.status === 'active').length;
  const completed = assessments.filter(a => a.latest_session?.status === 'ended' && a.latest_session?.end_reason !== 'error').length;

  const filteredAssessments = useMemo(() => {
    if (!searchQuery.trim()) return assessments;
    const q = searchQuery.toLowerCase();
    return assessments.filter((a) => 
      a.name.toLowerCase().includes(q) || 
      a.id.toString().toLowerCase().includes(q)
    );
  }, [assessments, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar Assessment</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola dan pantau seluruh sesi wawancara AI kandidat Anda.</p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} size="lg" className="shadow-sm transition-transform active:scale-95 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Buat Assessment
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assessment</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sesi Aktif</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : active}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diselesaikan</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : completed}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-4 text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          Gagal memuat data assessment. Silakan muat ulang halaman.
        </div>
      )}

      {/* Grid of Assessments */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Semua Assessment</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari assessment..."
              className="pl-9 bg-background focus-visible:ring-primary h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : assessments.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center bg-muted/20">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Belum Ada Assessment</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">Anda belum membuat assessment apa pun. Mulai buat assessment pertama untuk mengundang kandidat.</p>
            <Button onClick={() => navigate("/assessments/new")} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Buat Assessment Pertama
            </Button>
          </div>
        ) : filteredAssessments.length === 0 ? (
           <div className="border border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center bg-muted/5">
            <Search className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">Tidak ditemukan</h3>
            <p className="text-sm text-muted-foreground">Tidak ada assessment yang cocok dengan pencarian "{searchQuery}".</p>
            <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-primary">Bersihkan pencarian</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssessments.map((a) => (
              <Card
                key={a.id}
                className="group cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col overflow-hidden"
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
              >
                <div className="h-1 w-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <CardHeader className="pb-3 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-background text-xs font-medium text-muted-foreground border-muted-foreground/30">ID: {a.id.toString().substring(0, 8)}</Badge>
                    <div className="flex items-center gap-2">
                      <SessionSummary session={a.latest_session} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                            onClick={(e) => e.stopPropagation()}
                            disabled={deletingId === a.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tindakan ini tidak dapat dibatalkan. Assessment <strong>{a.name}</strong> beserta seluruh data kandidat, sesi, laporan portfolio, dan transkrip yang terkait dengan assessment ini akan dihapus secara permanen dari server.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(a.id);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deletingId === a.id ? "Menghapus..." : "Ya, Hapus"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">{a.name}</CardTitle>
                  <CardDescription className="flex items-center mt-2 text-xs">
                    <Clock className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                    Waktu Maksimal: {a.time_limit_min} Menit
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
