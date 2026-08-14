import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { vacanciesApi } from "@/services/vacancies";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import {
  Plus,
  Briefcase,
  ChevronRight,
  Search,
  ChevronLeft,
  Filter,
  Layers,
  Trash2,
  Pencil,
  Loader2,
  X,
  ArrowUpDown,
  AlertCircle
} from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { Vacancy } from "@/types";

const ITEMS_PER_PAGE = 6;

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [taxonomySkills, setTaxonomySkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchRole, setSearchRole] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-asc" | "name-desc">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [vacancyToDelete, setVacancyToDelete] = useState<Vacancy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    skillTaxonomiesApi
      .list()
      .then((res) => {
        setTaxonomySkills(res.data.skill_taxonomies.map((s) => s.skill_label));
      })
      .catch(() => {});
  }, []);

  // Extract all unique skills across master taxonomy + vacancies
  const availableSkills = useMemo(() => {
    const skillSet = new Set<string>(taxonomySkills);
    vacancies.forEach((v) => {
      v.skills?.forEach((s) => {
        if (s.skill_label?.trim()) skillSet.add(s.skill_label.trim());
      });
    });
    return Array.from(skillSet).sort();
  }, [vacancies, taxonomySkills]);

  const filteredVacancies = useMemo(() => {
    const list = vacancies.filter((v) => {
      const matchRole = !searchRole.trim() || v.role_title.toLowerCase().includes(searchRole.toLowerCase().trim());
      const matchSkill =
        selectedSkill === "all" ||
        v.skills?.some((s) => s.skill_label.toLowerCase() === selectedSkill.toLowerCase());

      return matchRole && matchSkill;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === "newest") return b.id - a.id;
      if (sortBy === "oldest") return a.id - b.id;
      if (sortBy === "name-asc") return a.role_title.localeCompare(b.role_title);
      if (sortBy === "name-desc") return b.role_title.localeCompare(a.role_title);
      return 0;
    });
  }, [vacancies, searchRole, selectedSkill, sortBy]);

  const totalPages = Math.ceil(filteredVacancies.length / ITEMS_PER_PAGE) || 1;
  const paginatedVacancies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVacancies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVacancies, currentPage]);

  const handleDeleteConfirm = async () => {
    if (!vacancyToDelete) return;
    setIsDeleting(true);
    try {
      await vacanciesApi.delete(vacancyToDelete.id);
      setVacancies((prev) => prev.filter((v) => v.id !== vacancyToDelete.id));
      setVacancyToDelete(null);
    } catch {
      setError(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(searchRole.trim()) || selectedSkill !== "all" || sortBy !== "newest";

  const clearAllFilters = () => {
    setSearchRole("");
    setSelectedSkill("all");
    setSortBy("newest");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-28 sm:pb-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vacancies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Benchmark job profiles for candidate Fit/Gap scoring and competency analysis
          </p>
        </div>
        <Button
          onClick={() => navigate("/vacancies/new")}
          className="hidden sm:flex bg-primary hover:bg-primary/90 text-white font-semibold h-10 shadow-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>Failed to perform action. Please refresh the page.</span>
        </div>
      )}

      {/* ── Separated Filters: Role Search + Searchable Skill Select + Sort By ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 flex-1">
          {/* Filter 1: Search by Role Title */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search role title..."
              value={searchRole}
              onChange={(e) => {
                setSearchRole(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-sm bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Filter 2: Searchable Dropdown Filter by Skill */}
          <SearchableSelect
            options={availableSkills}
            value={selectedSkill}
            onChange={(val) => {
              setSelectedSkill(val);
              setCurrentPage(1);
            }}
            allLabel="All Skills"
            placeholder="Select skill"
          />

          {/* Filter 3: Sort By Dropdown */}
          <div className="w-full sm:w-44">
            <Select
              value={sortBy}
              onValueChange={(val: any) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-slate-50/50 border-slate-200">
                <div className="flex items-center gap-2 truncate">
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name-asc">Role A → Z</SelectItem>
                <SelectItem value="name-desc">Role Z → A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
            {filteredVacancies.length} vacancy{filteredVacancies.length !== 1 ? "ies" : ""}
          </Badge>
        </div>
      </div>

      {/* ── Content Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        /* ── Global Empty State ── */
        <div className="border-2 border-dashed rounded-3xl p-12 text-center space-y-4 bg-white">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Briefcase className="h-7 w-7 text-slate-400" />
          </div>
          <div className="max-w-sm mx-auto">
            <p className="font-bold text-slate-900 text-base">No vacancies configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a benchmark role with required competency levels to run Fit/Gap reports.
            </p>
          </div>
          <Button onClick={() => navigate("/vacancies/new")} className="bg-primary text-white shadow-xs">
            <Plus className="h-4 w-4 mr-1.5" /> Create Vacancy
          </Button>
        </div>
      ) : filteredVacancies.length === 0 ? (
        /* ── Filter Empty State ── */
        <div className="border border-slate-200 rounded-2xl p-10 text-center space-y-3 bg-white">
          <Filter className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">No vacancies match your filter</p>
          <p className="text-xs text-muted-foreground">Try clearing your filters or selecting a different skill.</p>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Reset Filters
          </Button>
        </div>
      ) : (
        /* ── 2-3 Column Grid Cards ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedVacancies.map((v) => {
            const skillsList = v.skills || [];
            const displaySkills = skillsList.slice(0, 3);
            const remainingCount = skillsList.length - 3;

            return (
              <Card
                key={v.id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group flex flex-col justify-between overflow-hidden bg-white border-slate-200/90"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <div>
                  {/* Card Header */}
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 flex items-center justify-center shrink-0 border border-indigo-200/80 group-hover:scale-105 transition-transform">
                        <Briefcase className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                          {v.role_title}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Layers className="h-3 w-3" />
                          <span>{skillsList.length} required skill{skillsList.length !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Body / Skills Preview */}
                  <CardContent className="px-5 py-3 space-y-3">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Required Benchmarks
                      </span>
                      {displaySkills.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No skill benchmarks added.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {displaySkills.map((s, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className={cn(
                                "text-[11px] py-0.5 px-2 font-normal border flex items-center gap-1",
                                selectedSkill.toLowerCase() === s.skill_label.toLowerCase()
                                  ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              )}
                            >
                              <span>{s.skill_label}</span>
                              <span className="font-semibold text-primary text-[10px]">
                                ({LEVEL_LABELS[s.expected_level ?? 3]})
                              </span>
                            </Badge>
                          ))}
                          {remainingCount > 0 && (
                            <Badge variant="outline" className="text-[10px] text-slate-500 py-0.5 px-1.5 font-semibold">
                              +{remainingCount} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {v.culture_dimensions && (
                      <p className="text-xs text-slate-500 line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        "{v.culture_dimensions}"
                      </p>
                    )}
                  </CardContent>
                </div>

                {/* Card Footer Actions: Delete on Left, Edit on Right */}
                <CardFooter className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVacancyToDelete(v);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    <span>Delete</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/vacancies/${v.id}/edit`);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    <span>Edit Vacancy</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!vacancyToDelete} onOpenChange={(open) => !open && setVacancyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              Delete Vacancy?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{vacancyToDelete?.role_title}"</span>? This benchmark profile will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete Vacancy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Pagination Controls ── */}
      {!loading && filteredVacancies.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
            <span className="font-semibold text-slate-900">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredVacancies.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{filteredVacancies.length}</span> vacancies
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8 w-8 p-0 text-xs font-semibold", currentPage === pageNum ? "bg-primary text-white" : "")}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => navigate("/vacancies/new")}
        className="fixed bottom-20 right-4 sm:hidden z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-95 transition-all duration-150"
        aria-label="New Vacancy"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
