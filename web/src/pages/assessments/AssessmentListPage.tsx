import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search, Sparkles, Radio } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummaryBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
      Menunggu Kandidat
    </span>
  );

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        Live Now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
        Sesi Gagal
      </span>
    );

  if (session.status === "ended")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
        Selesai Dievaluasi
      </span>
    );

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
      Menunggu Kandidat
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = useMemo(() => {
    if (!search.trim()) return assessments;
    return assessments.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
  }, [assessments, search]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Asesmen Kompetensi</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {assessments.length} Asesmen
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Kelola template wawancara AI, pantau sesi langsung kandidat, dan evaluasi hasil portofolio.
          </p>
        </div>

        <Button
          onClick={() => navigate("/assessments/new")}
          className="rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Buat Asesmen Baru
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama asesmen atau peran pekerjaan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl bg-card border-border shadow-sm text-sm"
        />
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/10 rounded-2xl p-4 text-sm text-destructive flex items-center gap-2">
          Gagal memuat data asesmen. Silakan muat ulang halaman.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-dashed border-border rounded-3xl p-12 text-center space-y-4 bg-card/40">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {search ? "Tidak ada asesmen yang cocok dengan pencarian" : "Belum ada asesmen yang dibuat"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {search
                ? "Coba kata kunci lain atau bersihkan kotak pencarian."
                : "Buat asesmen pertama Anda untuk mulai menguji kandidat dengan asisten wawancara suara AI."}
            </p>
          </div>
          {!search && (
            <Button
              variant="outline"
              onClick={() => navigate("/assessments/new")}
              className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Buat Asesmen Sekarang
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredAssessments.map((a) => (
            <Card
              key={a.id}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <p className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {a.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded-md">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {a.time_limit_min} menit
                    </span>
                    <SessionSummaryBadge session={a.latest_session} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
