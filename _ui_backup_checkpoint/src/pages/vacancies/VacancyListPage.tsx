import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  Search,
  ChevronDown,
  Pencil,
  Trash2,
  Calendar,
  Layers,
} from "lucide-react";
import { LEVEL_TIERS } from "@/components/assessment/LevelRadio";
import TablePagination from "@/components/common/TablePagination";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Delete modal state
  const [vacancyToDelete, setVacancyToDelete] = useState<Vacancy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  const loadVacancies = async () => {
    try {
      setLoading(true);
      const res = await vacanciesApi.list();
      setVacancies(res.data.vacancies || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVacancies();
  }, []);

  const filteredVacancies = useMemo(() => {
    if (!searchQuery.trim()) return vacancies;
    const q = searchQuery.toLowerCase();
    return vacancies.filter(
      (v) =>
        v.role_title.toLowerCase().includes(q) ||
        (v.culture_dimensions && v.culture_dimensions.toLowerCase().includes(q))
    );
  }, [vacancies, searchQuery]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Slice for current page
  const paginatedVacancies = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVacancies.slice(startIndex, startIndex + pageSize);
  }, [filteredVacancies, currentPage, pageSize]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    const current = vacancies.find((v) => v.id === id);
    if (!current?.skills) {
      try {
        const res = await vacanciesApi.get(id);
        setVacancies((prev) =>
          prev.map((v) => (v.id === id ? res.data.vacancy : v))
        );
      } catch (e) {
        console.error("Failed to load full vacancy details", e);
      }
    }
  };

  const handleDelete = async () => {
    if (!vacancyToDelete) return;
    setDeleting(true);
    try {
      await vacanciesApi.delete(vacancyToDelete.id);
      setVacancies((prev) => prev.filter((v) => v.id !== vacancyToDelete.id));
      if (expandedId === vacancyToDelete.id) setExpandedId(null);
      setVacancyToDelete(null);
    } catch (e) {
      console.error("Failed to delete vacancy", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vacancies</h1>
            <Badge variant="outline" className="text-slate-600 bg-slate-50">
              {vacancies.length} Roles
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage job roles, expected skill competencies (Beginner to Expert), and company culture.
          </p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search vacancies by role title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load vacancies. Please check your backend connection.</span>
          <Button variant="outline" size="sm" onClick={loadVacancies}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredVacancies.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-sm text-muted-foreground bg-white">
          <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          {searchQuery ? (
            <p>No vacancies matching "{searchQuery}"</p>
          ) : (
            <>
              <p className="font-semibold text-slate-800 text-base mb-1">No vacancies yet</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Define the requirements and expected skill levels for your company's open positions.
              </p>
              <Button onClick={() => navigate("/vacancies/new")}>
                <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {paginatedVacancies.map((v) => {
              const isExpanded = expandedId === v.id;
              const skillCount = v.skills?.length ?? 0;

              return (
                <Card
                  key={v.id}
                  className="border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all duration-300 overflow-hidden bg-white"
                >
                  {/* Header Row */}
                  <div
                    className="py-3.5 px-4 sm:px-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors duration-200 select-none"
                    onClick={() => toggleExpand(v.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {v.role_title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {v.created_at ? new Date(v.created_at).toLocaleDateString() : "-"}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {skillCount} skills specified
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(v.id);
                        }}
                      >
                        <span className="mr-1 hidden sm:inline">
                          {isExpanded ? "Hide Details" : "View Details"}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 ease-in-out ${
                            isExpanded ? "rotate-180 text-primary" : "rotate-0 text-slate-400"
                          }`}
                        />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details Section */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                      isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden min-h-0">
                      <div
                        className={`px-4 sm:px-5 py-4 bg-slate-50/50 space-y-4 border-t border-slate-100 transition-opacity duration-300 ease-in-out ${
                          isExpanded ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        {/* Culture description / Team context */}
                        <div className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Team & Squad Dynamics:
                          </span>
                          <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                            {v.culture_dimensions?.trim() || "-"}
                          </p>
                        </div>

                        {/* Skill list */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Required Competencies & Expected Levels:
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {v.skills?.length || 0} skills configured
                            </span>
                          </div>

                          {v.skills && v.skills.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {v.skills.map((skill) => {
                                const tier = LEVEL_TIERS[skill.expected_level] || {
                                  code: `L${skill.expected_level}`,
                                  name: "Proficient",
                                  desc: "",
                                };

                                return (
                                  <div
                                    key={skill.id}
                                    className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-start justify-between gap-2 shadow-2xs hover:border-slate-300 transition-colors"
                                  >
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-xs text-slate-900 truncate">
                                          {skill.skill_label}
                                        </span>
                                        {skill.skill_id && (
                                          <span className="text-[10px] text-muted-foreground font-mono">
                                            SK-{skill.skill_id}
                                          </span>
                                        )}
                                      </div>
                                      {tier.desc && (
                                        <span className="text-[11px] text-muted-foreground block line-clamp-1">
                                          {tier.desc}
                                        </span>
                                      )}
                                    </div>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20 shrink-0 px-2.5 py-0.5"
                                    >
                                      {tier.name}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80 text-xs text-muted-foreground">
                              No specific skills attached yet. Click "Edit Vacancy" to add expected skills.
                            </div>
                          )}
                        </div>

                        {/* Actions: Edit & Delete */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                            onClick={() => setVacancyToDelete(v)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs"
                            onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit Vacancy
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredVacancies.length}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!vacancyToDelete} onOpenChange={(open) => !open && setVacancyToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Delete Vacancy
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800">{vacancyToDelete?.role_title}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setVacancyToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete Vacancy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
