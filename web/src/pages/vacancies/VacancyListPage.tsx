import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Vacancy, PaginationMeta } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10,
  });

  const [vacancyToDelete, setVacancyToDelete] =
    useState<Vacancy | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!vacancyToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await vacanciesApi.delete(vacancyToDelete.id);

      setVacancyToDelete(null);

      if (vacancies.length === 1 && page > 1) {
        setPage((current) => current - 1);
        return;
      }

      const res = await vacanciesApi.list(page, debouncedSearch);

      setVacancies(res.data.vacancies);
      setMeta(res.data.meta);
    } catch (e: any) {
      setDeleteError(
        e?.response?.data?.errors?.[0]?.message ??
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        "Failed to delete vacancy."
      );
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(false);

    vacanciesApi
      .list(page, debouncedSearch)
      .then((res) => {
        if (cancelled) return;

        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch]);

  const startItem =
    meta.total_count === 0
      ? 0
      : (meta.current_page - 1) * meta.per_page + 1;

  const endItem = Math.min(
    meta.current_page * meta.per_page,
    meta.total_count
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vacancies</h1>

        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Vacancy
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search vacancies..."
          className="pl-9"
        />
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          {debouncedSearch ? (
            <>
              <p className="font-medium text-foreground">
                No vacancies found
              </p>

              <p className="mt-1">
                No results match "{debouncedSearch}".
              </p>
            </>
          ) : (
            <>
              <p className="mb-3">No vacancies yet.</p>

              <Button
                variant="outline"
                onClick={() => navigate("/vacancies/new")}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create your first vacancy
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {vacancies.map((v) => (
              <Card
                key={v.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />

                    <p className="font-medium text-sm">
                      {v.role_title}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Delete vacancy"
                      onClick={(e) => {
                        e.stopPropagation();

                        setDeleteError(null);
                        setVacancyToDelete(v);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {meta.total_count > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Showing {startItem}–{endItem} of {meta.total_count}
              </p>

              {meta.total_pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <span className="text-xs text-muted-foreground px-2">
                    Page {meta.current_page} of {meta.total_pages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      page >= meta.total_pages || loading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          meta.total_pages,
                          current + 1
                        )
                      )
                    }
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <Dialog
        open={!!vacancyToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setVacancyToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete vacancy?</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Vacancy{" "}
              <span className="font-medium text-foreground">
                {vacancyToDelete?.role_title}
              </span>{" "}
              will be deleted.
            </p>

            <p className="text-xs text-muted-foreground">
              This action cannot be undone.
            </p>

            {deleteError && (
              <p className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setVacancyToDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}

              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}