import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  MapPin,
  Sparkles,
  Search,
  ExternalLink,
  Edit3,
  Layers,
  Building2,
  Trash2,
  Loader2,
} from "lucide-react";
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
import type { Vacancy } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";
import { motion } from "framer-motion";

interface RoleCategory {
  id: string;
  label: string;
  keywords?: string[];
}

const ROLE_CATEGORIES: RoleCategory[] = [
  { id: "all", label: "Semua Kategori" },
  {
    id: "engineering",
    label: "Engineering & Tech",
    keywords: ["engineer", "developer", "frontend", "backend", "fullstack", "software", "devops", "qa", "tech"],
  },
  {
    id: "product",
    label: "Product & Design",
    keywords: ["product", "design", "ui", "ux", "pm", "owner"],
  },
  {
    id: "data",
    label: "Data & AI",
    keywords: ["data", "analyst", "analytics", "ai", "machine learning", "bi", "scientist"],
  },
];

function VacancyCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 animate-pulse">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-36 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="w-6 h-6 rounded-lg bg-slate-100" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-slate-100 rounded" />
          <div className="h-3 w-4/5 bg-slate-100 rounded" />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <div className="h-6 w-20 bg-slate-100 rounded-full" />
          <div className="h-6 w-24 bg-slate-100 rounded-full" />
          <div className="h-6 w-16 bg-slate-100 rounded-full" />
        </div>
      </div>
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="h-3 w-20 bg-slate-100 rounded" />
        <div className="h-8 w-24 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const navigate = useNavigate();

  // Debounce search query by 280ms to provide smooth skeleton feedback
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setIsFiltering(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFilterSelect = (catId: string) => {
    if (catId === selectedFilter) return;
    setIsFiltering(true);
    setSelectedFilter(catId);
    setTimeout(() => setIsFiltering(false), 200);
  };

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await vacanciesApi.delete(id);
      setVacancies((prev) => prev.filter((v) => v.id !== id));
    } catch (e: any) {
      setDeleteError(
        e?.response?.data?.errors?.[0]?.message ||
          "Gagal menghapus lowongan pekerjaan."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      // 1. Text search matching with debounced query
      const query = debouncedSearchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        v.role_title.toLowerCase().includes(query) ||
        v.culture_dimensions?.toLowerCase().includes(query) ||
        v.competency_expectations?.toLowerCase().includes(query) ||
        v.skills?.some((s) => s.skill_label.toLowerCase().includes(query));

      if (!matchSearch) return false;

      // 2. Functional Category matching
      if (selectedFilter === "all") return true;

      const cat = ROLE_CATEGORIES.find((c) => c.id === selectedFilter);
      if (!cat || !cat.keywords) return true;

      const titleLower = v.role_title.toLowerCase();
      const skillsLower = v.skills?.map((s) => s.skill_label.toLowerCase()).join(" ") || "";
      const combined = `${titleLower} ${skillsLower}`;

      return cat.keywords.some((kw) => combined.includes(kw));
    });
  }, [vacancies, debouncedSearchQuery, selectedFilter]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Hero Banner matching Reference Image 2 */}
      <HeroBanner
        badgeText="⭐️ Rakamin Talent & Career Pipeline"
        title="Explore Job Opportunities"
        highlightText="& Role Profiles"
        subtitle="Kelola lowongan pekerjaan, target skill level, dan benchmark rubrik B7 untuk evaluasi fit/gap kandidat secara objektif."
        bulletPoints={[
          "Penetapan target kompetensi terukur per role (L1 s/d L5)",
          "Perbandingan otomatis dengan hasil wawancara AI kandidat",
          "Dukungan human-in-the-loop review dan governance catatan asesor",
        ]}
        primaryAction={{
          label: "Tambah Lowongan Baru",
          onClick: () => navigate("/vacancies/new"),
          icon: <Plus className="h-4 w-4 mr-1.5" />,
        }}
        secondaryAction={{
          label: "Daftar Assessment",
          onClick: () => navigate("/assessments"),
          icon: <Sparkles className="h-4 w-4 mr-1.5" />,
        }}
        imageSrc="/images/counseling.png"
        imageAlt="Rakamin Career Counseling"
        imageFloatingBadge={{
          title: "Standar Rakamin",
          subtitle: "B7 Competency Matrix",
        }}
      />

      {/* Search & Filter Section (like Reference Image 2) */}
      <div className="space-y-4">
        <div className="text-center max-w-md mx-auto space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Cari &amp; Kelola Posisi Karir
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Daftar role aktif yang siap diuji dengan asesmen AI otomatis
          </p>
        </div>

        <div className="max-w-2xl mx-auto flex items-center gap-2 p-1.5 rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-[#01959f] focus-within:ring-2 focus-within:ring-[#01959f]/15 transition-all">
          <div className="flex-1 flex items-center gap-2 px-3">
            {isFiltering ? (
              <Loader2 className="h-4 w-4 text-[#01959f] animate-spin shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <input
              type="text"
              placeholder="Cari berdasarkan judul role, skill, atau kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm bg-transparent outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 border-none shadow-none text-slate-800 placeholder:text-slate-400"
              style={{ outline: "none", boxShadow: "none" }}
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
            >
              Clear
            </button>
          )}
          <Button
            size="sm"
            className="rounded-xl px-4 text-xs font-semibold shadow-xs"
          >
            Cari Role
          </Button>
        </div>

        {/* Quick Filter Pills by Functional Role Category */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
          {ROLE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterSelect(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedFilter === cat.id
                  ? "bg-[#01959f] text-white shadow-xs scale-102"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
          <span>Gagal memuat daftar lowongan pekerjaan. Pastikan server API berjalan normal.</span>
        </div>
      )}

      {/* Delete error notification */}
      {deleteError && (
        <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive font-medium flex items-center justify-between gap-2">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-xs underline text-destructive">Tutup</button>
        </div>
      )}

      {/* Loading & Filtering states with Skeleton cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <VacancyCardSkeleton key={i} />
          ))}
        </div>
      ) : isFiltering ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#01959f] py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Memperbarui daftar lowongan...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <VacancyCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : filteredVacancies.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4 bg-white/60">
          <div className="w-14 h-14 rounded-2xl bg-[#01959f]/10 text-[#01959f] flex items-center justify-center mx-auto">
            <Briefcase className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">
              {searchQuery ? "Tidak ada role yang cocok" : "Belum ada lowongan tersimpan"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? "Coba ubah kata kunci pencarian Anda."
                : "Buat profil role lowongan pertama Anda untuk mulai memetakan kebutuhan kompetensi."}
            </p>
          </div>
          <Button
            variant="cta"
            onClick={() => navigate("/vacancies/new")}
            className="rounded-xl shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Tambah Lowongan Pertama
          </Button>
        </div>
      ) : (
        /* Rich Card Grid matching Reference Image 1 & 2 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVacancies.map((v, idx) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              className="group bg-white rounded-2xl border border-slate-200/90 hover:border-[#01959f]/50 p-5 shadow-xs hover:shadow-lg hover:shadow-teal-900/5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                {/* Header: Logo Circle, Org, Title & Delete Action */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1.5 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                      <img
                        src="/images/rakamin-logo.png"
                        alt="Rakamin"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Rakamin Partner
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-[#01959f] transition-colors leading-snug break-words">
                        {v.role_title}
                      </h3>
                    </div>
                  </div>

                  {/* Header right: Delete Trigger */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        title="Hapus Lowongan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-bold text-slate-900">
                          Hapus Lowongan &quot;{v.role_title}&quot;?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-slate-600">
                          Tindakan ini tidak dapat dibatalkan. Profil lowongan, benchmark rubrik, dan laporan fit/gap terkait akan dihapus secara permanen.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(v.id)}
                          disabled={deletingId === v.id}
                          className="bg-destructive hover:bg-destructive/90 text-white font-semibold rounded-xl"
                        >
                          {deletingId === v.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Location & Metadata */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Jakarta Selatan • DKI Jakarta</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-800 font-semibold">Competitive Salary &amp; Benefits</span>
                  </div>
                </div>

                {/* Vacancy Culture & Context */}
                <div className="space-y-1 text-xs text-slate-600 min-h-[32px]">
                  {v.culture_dimensions ? (
                    <p className="text-slate-500 line-clamp-2 leading-relaxed text-[11px]">
                      {v.culture_dimensions}
                    </p>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">
                      Standar rubrik evaluasi kompetensi kandidat Rakamin AI.
                    </p>
                  )}
                </div>

                {/* Tags based on real B7 rubric and vacancy state */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-[#01808a] border border-teal-200/60 whitespace-nowrap">
                    Standar Rubrik B7
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 whitespace-nowrap">
                    {v.skills?.length || 0} Target Benchmark
                  </span>
                </div>

                {/* Target Skills Snippet */}
                {v.skills && v.skills.length > 0 ? (
                  <div className="pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1.5">
                      <Layers className="h-3 w-3 text-[#01959f]" />
                      <span>{v.skills.length} Target Rubrics:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {v.skills.slice(0, 3).map((s, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md whitespace-nowrap"
                        >
                          {s.skill_label} (L{s.expected_level})
                        </span>
                      ))}
                      {v.skills.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-semibold px-1 py-0.5 whitespace-nowrap">
                          +{v.skills.length - 3} lainnya
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2.5 border-t border-slate-100/80 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Layers className="h-3 w-3 text-slate-300 shrink-0" />
                    <span>Belum ada benchmark rubrik. Klik <strong>Edit Rubrik</strong> untuk konfigurasi.</span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                  className="flex-1 rounded-xl text-xs font-semibold h-8 border-slate-200 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Rubrik
                </Button>
                <Button
                  variant="cta"
                  size="sm"
                  onClick={() => navigate("/assessments/new")}
                  className="flex-1 rounded-xl text-xs font-bold h-8 shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Uji Kandidat
                </Button>
              </div>
            </motion.div>
          ))}

          {/* Issue 6: If only 1 vacancy, add an inviting creation card and guidance card to balance the 3-column grid */}
          {filteredVacancies.length === 1 && !searchQuery && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.25 }}
                onClick={() => navigate("/vacancies/new")}
                className="rounded-2xl border-2 border-dashed border-[#01959f]/30 hover:border-[#01959f] bg-teal-50/20 hover:bg-teal-50/50 p-6 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer min-h-[260px] group shadow-2xs hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#01959f]/10 text-[#01959f] group-hover:bg-[#01959f] group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-2xs">
                  <Plus className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-[#01959f] transition-colors">
                    Buka Lowongan Role Baru
                  </h4>
                  <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                    Petakan standar rubrik L1-L5 untuk role lain seperti Backend, Product, atau QA.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#01959f] bg-white px-3.5 py-1 rounded-full border border-[#01959f]/30 group-hover:border-[#01959f] shadow-2xs">
                  + Buat Role Baru
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.25 }}
                className="rounded-2xl border border-amber-200/80 bg-linear-to-br from-amber-50/50 via-yellow-50/25 to-white p-5 flex flex-col justify-between shadow-2xs min-h-[260px]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-700 font-extrabold text-xs tracking-wider uppercase">
                    <Sparkles className="h-4 w-4 text-[#fbc036]" />
                    Panduan Standar Rakamin
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Benchmark Rubrik Objektif B7
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Platform AI Interview membandingkan hasil wawancara kandidat secara langsung terhadap target level kompetensi role ini untuk menghasilkan laporan Fit/Gap yang presisi.
                  </p>
                </div>
                <div className="pt-3 border-t border-amber-200/50 flex items-center justify-between text-xs font-bold text-amber-900">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Sistem Terkalibrasi
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/assessments")}
                    className="text-[#01959f] hover:underline flex items-center gap-1 font-extrabold cursor-pointer"
                  >
                    Daftar Asesmen →
                  </button>
                </div>
              </motion.div>
            </>
          )}

          {/* If 2 vacancies, add 1 creation card to complete the row */}
          {filteredVacancies.length === 2 && !searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.25 }}
              onClick={() => navigate("/vacancies/new")}
              className="rounded-2xl border-2 border-dashed border-[#01959f]/30 hover:border-[#01959f] bg-teal-50/20 hover:bg-teal-50/50 p-6 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer min-h-[260px] group shadow-2xs hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#01959f]/10 text-[#01959f] group-hover:bg-[#01959f] group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-2xs">
                <Plus className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-[#01959f] transition-colors">
                  Buka Lowongan Role Baru
                </h4>
                <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                  Tambah posisi lowongan kerja lainnya untuk memetakan ekspektasi skill.
                </p>
              </div>
              <span className="text-xs font-bold text-[#01959f] bg-white px-3.5 py-1 rounded-full border border-[#01959f]/30 group-hover:border-[#01959f] shadow-2xs">
                + Buat Role Baru
              </span>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
