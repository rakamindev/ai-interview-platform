
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { vacanciesApi } from "@/services/vacancies";

import type { PaginationMeta, Vacancy } from "@/types";
import VacancySkillGrid from "@/components/vacancies/VacancySkillGrid";

const initialMeta: PaginationMeta = {
  current_page: 1,
  total_pages: 1,
  total_count: 0,
  per_page: 10,
};

function formatJobCreated(
  date: string | null | undefined
) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(parsed);
}

function getErrorMessage(error: unknown): string {
  const response = (
    error as {
      response?: {
        data?: {
          errors?: Array<
            string | { message?: string }
          >;
          error?: string;
          message?: string;
        };
      };
    }
  )?.response;

  const firstError = response?.data?.errors?.[0];

  if (typeof firstError === "string") {
    return firstError;
  }

  if (
    firstError &&
    typeof firstError.message === "string"
  ) {
    return firstError.message;
  }

  return (
    response?.data?.error ??
    response?.data?.message ??
    "Failed to delete vacancy."
  );
}

export default function VacancyListPage() {
  const navigate = useNavigate();

  const [vacancies, setVacancies] = useState<
    Vacancy[]
  >([]);

  const [meta, setMeta] =
    useState<PaginationMeta>(initialMeta);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [vacancyToDelete, setVacancyToDelete] =
    useState<Vacancy | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] =
    useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const loadVacancies = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await vacanciesApi.list(
          page,
          debouncedSearch
        );

        if (cancelled) {
          return;
        }

        setVacancies(response.data.vacancies);
        setMeta(response.data.meta);
      } catch (requestError) {
        console.error(
          "Failed to load vacancies:",
          requestError
        );

        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadVacancies();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, reloadKey]);

  const handleDelete = async () => {
    if (!vacancyToDelete || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await vacanciesApi.delete(
        vacancyToDelete.id
      );

      setVacancyToDelete(null);

      toast.success(
        "Vacancy deleted successfully."
      );

      if (
        vacancies.length === 1 &&
        page > 1
      ) {
        setPage((current) => current - 1);
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch (requestError: unknown) {
      const message =
        getErrorMessage(requestError);

      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const openVacancy = (id: number) => {
    navigate(`/vacancies/${id}/edit`);
  };

  const openDeleteDialog = (
    vacancy: Vacancy
  ) => {
    setDeleteError(null);
    setVacancyToDelete(vacancy);
  };

  const startItem =
    meta.total_count === 0
      ? 0
      : (meta.current_page - 1) *
      meta.per_page +
      1;

  const endItem = Math.min(
    meta.current_page * meta.per_page,
    meta.total_count
  );

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Vacancy management
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Vacancies
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Manage job positions and their skill
            requirements.
          </p>
        </div>

        <Button
          onClick={() =>
            navigate("/vacancies/new")
          }
          className="h-11 rounded-xl px-5 shadow-sm shadow-primary/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Vacancy
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {debouncedSearch
                ? "Matching Vacancies"
                : "Total Vacancies"}
            </p>

            {loading ? (
              <Skeleton className="mt-4 h-10 w-20" />
            ) : (
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
                {error
                  ? "—"
                  : meta.total_count}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">
              {debouncedSearch
                ? "Results for your search"
                : "Positions in your workspace"}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BriefcaseBusiness className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              On this page
            </p>

            {loading ? (
              <Skeleton className="mt-4 h-10 w-20" />
            ) : (
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
                {error
                  ? "—"
                  : vacancies.length}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">
              Vacancies currently displayed
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Layers3 className="h-6 w-6" />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-5 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                All Vacancies
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Find a position and manage its
                requirements.
              </p>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              {loading || error
                ? "—"
                : meta.total_count}{" "}
              results
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search vacancies..."
              aria-label="Search vacancies"
              className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-10 focus-visible:ring-primary"
            />

            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center px-6 py-14 text-center"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>

            <p className="font-semibold text-slate-900">
              Unable to load vacancies
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Please try again.
            </p>

            <Button
              variant="outline"
              className="mt-5 rounded-xl"
              onClick={() =>
                setReloadKey(
                  (current) => current + 1
                )
              }
            >
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton
                key={item}
                className="h-16 rounded-xl"
              />
            ))}
          </div>
        ) : vacancies.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {debouncedSearch ? (
                <Search className="h-7 w-7" />
              ) : (
                <BriefcaseBusiness className="h-7 w-7" />
              )}
            </div>

            <p className="text-base font-bold text-slate-900">
              {debouncedSearch
                ? "No vacancies found"
                : "No vacancies yet"}
            </p>

            <p className="mt-2 max-w-sm text-sm text-slate-500">
              {debouncedSearch
                ? `No results match "${debouncedSearch}".`
                : "Create your first vacancy to define a position and its skill requirements."}
            </p>

            {debouncedSearch ? (
              <Button
                variant="outline"
                className="mt-6 rounded-xl"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear search
              </Button>
            ) : (
              <Button
                className="mt-6 rounded-xl"
                onClick={() =>
                  navigate("/vacancies/new")
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Vacancy
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[23%]" />
                  <col className="w-[18%]" />
                  <col className="w-[43%]" />
                  <col className="w-[16%]" />
                </colgroup>

                <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Job Position
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Job Created
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Required Skills
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {vacancies.map((vacancy) => (
                    <tr
                      key={vacancy.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-6 py-5 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <BriefcaseBusiness className="h-5 w-5" />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openVacancy(vacancy.id)
                            }
                            className="min-w-0 pt-2 text-left text-sm font-semibold text-slate-800 hover:text-primary hover:underline"
                          >
                            {vacancy.role_title}
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <div className="inline-flex items-start gap-2 text-sm text-slate-600">
                          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                          <span className="font-medium leading-5">
                            {formatJobCreated(
                              vacancy.created_at
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <VacancySkillGrid
                          skills={vacancy.skills}
                        />
                      </td>

                      <td className="px-6 py-5 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() =>
                              openVacancy(vacancy.id)
                            }
                          >
                            Open
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${vacancy.role_title}`}
                            title="Delete vacancy"
                            className="h-9 w-9 rounded-lg p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              openDeleteDialog(vacancy)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {vacancies.map((vacancy) => (
                <div
                  key={vacancy.id}
                  className="space-y-4 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {vacancy.role_title}
                      </p>

                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {formatJobCreated(
                          vacancy.created_at
                        )}
                      </p>

                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <Layers3 className="h-3.5 w-3.5 shrink-0" />

                        {Array.isArray(vacancy.skills)
                          ? `${vacancy.skills.length
                          } required ${vacancy.skills.length === 1
                            ? "skill"
                            : "skills"
                          }`
                          : "Skills unavailable"}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${vacancy.role_title}`}
                      className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-red-600"
                      onClick={() =>
                        openDeleteDialog(vacancy)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Required Skills
                    </p>

                    <VacancySkillGrid
                      skills={vacancy.skills}
                      compact
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() =>
                        openVacancy(vacancy.id)
                      }
                    >
                      Open
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-slate-500">
                Showing {startItem}–{endItem} of{" "}
                {meta.total_count}
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
                    className="rounded-lg"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>

                  <span className="px-2 text-xs text-slate-500">
                    Page {meta.current_page} of{" "}
                    {meta.total_pages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      page >= meta.total_pages ||
                      loading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          meta.total_pages,
                          current + 1
                        )
                      )
                    }
                    className="rounded-lg"
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Dialog
        open={Boolean(vacancyToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setVacancyToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>

            <DialogTitle>
              Delete vacancy?
            </DialogTitle>

            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-800">
                {vacancyToDelete?.role_title}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {deleteError}
            </div>
          )}

          <DialogFooter className="gap-2">
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
              onClick={() => {
                void handleDelete();
              }}
            >
              {deleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Vacancy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
