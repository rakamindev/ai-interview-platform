import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  ChevronRight,
  Search,
  Layers,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { Vacancy } from "@/types";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const },
  },
};

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
    if (!searchQuery.trim()) return vacancies;
    const q = searchQuery.toLowerCase();
    return vacancies.filter((v) => v.role_title.toLowerCase().includes(q));
  }, [vacancies, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Vacancies</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Role profiles, expected competency levels, and culture benchmarks for Fit/Gap evaluation.
          </p>
        </div>
        <Button
          onClick={() => navigate("/vacancies/new")}
          className="active:scale-[0.98] transition-transform shadow-xs font-medium text-xs h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {/* Metrics strip */}
      {!loading && !error && vacancies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <div className="p-3 rounded-xl border border-border/70 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              <span>Active Vacancies</span>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-foreground">{vacancies.length}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {!loading && vacancies.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vacancies by title..."
            className="pl-9 h-9 text-xs rounded-xl bg-white border-border/80 focus-visible:ring-primary/20"
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load vacancies. Please refresh the page.</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        /* Empty state */
        <div className="border border-dashed border-border rounded-2xl p-12 text-center bg-white/50">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">No vacancies created yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-5">
            Create role criteria benchmarks to run automated Fit/Gap analysis against candidate portfolios.
          </p>
          <Button onClick={() => navigate("/vacancies/new")} size="sm" className="rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        /* Vacancy list */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2.5"
        >
          {filteredVacancies.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No vacancies matching "{searchQuery}"
            </p>
          ) : (
            filteredVacancies.map((v) => (
              <motion.div
                key={v.id}
                variants={itemVariants}
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                className="group relative flex items-center justify-between p-4 rounded-xl border border-border/80 bg-white hover:border-primary/50 hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-[0.995]"
              >
                <div className="space-y-1.5 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-neutral-100 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {v.role_title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground ml-9">
                    {v.skills && v.skills.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Layers className="h-3 w-3 text-muted-foreground/70" />
                        {v.skills.length} required skills
                      </span>
                    )}
                    {v.culture_dimensions && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                        <Sparkles className="h-3 w-3 text-amber-500/80" />
                        Culture mapped
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}
