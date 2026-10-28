import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, ChevronRight, Search, X, ArrowUpDown, Trash2, Loader2 } from "lucide-react";
import type { Vacancy, PaginationMeta } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at">("created_at");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingVacancy, setDeletingVacancy] = useState<Vacancy | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageTitle("Vacancies");

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadVacancies = useCallback(
    async (p: number, q: string, sort: "created_at" | "updated_at") => {
      setLoading(true);
      setError(false);
      try {
        const res = await vacanciesApi.list({
          page: p,
          search: q,
          sort_by: sort,
        });
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadVacancies(page, searchQuery, sortBy);
  }, [page, searchQuery, sortBy, loadVacancies]);

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setSortBy("created_at");
    setPage(1);
  };

  const handleDeleteVacancy = async () => {
    if (!deletingVacancy) return;
    setDeleteLoading(true);
    try {
      await vacanciesApi.delete(deletingVacancy.id);
      toast("Vacancy deleted successfully");
      setDeletingVacancy(null);
      loadVacancies(page, searchQuery, sortBy);
    } catch {
      toast("Failed to delete vacancy", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const isFiltered = Boolean(searchQuery || sortBy !== "created_at");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Vacancies</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure job vacancies, target skill competencies, and benchmark reports.
          </p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {/* Search Bar with Sort aligned to the right */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search vacancies by job title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9 h-10 w-full bg-background"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort selector & reset placed immediately to the right */}
        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="vacancy-sort"
            className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sort:</span>
          </label>
          <select
            id="vacancy-sort"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as "created_at" | "updated_at");
              setPage(1);
            }}
            className="h-10 text-xs bg-background border border-input rounded-md px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="created_at">Newest Created (Default)</option>
            <option value="updated_at">Recently Updated</option>
          </select>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        isFiltered ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground space-y-3">
            <p>
              No vacancies matching{" "}
              {searchQuery && (
                <>
                  &ldquo;<span className="font-semibold text-foreground">{searchQuery}</span>&rdquo;
                </>
              )}
              .
            </p>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Reset all filters
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
            <p className="mb-3">No vacancies yet.</p>
            <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {vacancies.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/40 hover:shadow-xs transition-all"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{v.role_title}</p>
                  {v.culture_dimensions && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {v.culture_dimensions}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingVacancy(v);
                    }}
                    title="Delete vacancy"
                    aria-label="Delete vacancy"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {meta && (
        <Pagination
          currentPage={meta.current_page}
          totalPages={meta.total_pages}
          totalCount={meta.total_count}
          perPage={meta.per_page}
          onPageChange={(p) => setPage(p)}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deletingVacancy}
        onOpenChange={(open) => !open && setDeletingVacancy(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vacancy?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the vacancy &ldquo;
              <strong className="text-foreground">{deletingVacancy?.role_title}</strong>
              &rdquo;? All associated benchmark reports and candidate comparisons will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVacancy}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Vacancy"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
