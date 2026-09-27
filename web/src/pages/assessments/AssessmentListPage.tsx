
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import AssessmentStatistics from "@/components/assessment/AssessmentStatistics";

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

import { assessmentsApi } from "@/services/assessments";
import { getApiErrorMessage } from "@/utils/apiError";

import type { Assessment } from "@/types";
import type { AssessmentsMeta } from "@/services/assessments";

const initialMeta: AssessmentsMeta = {
  current_page: 1,
  total_pages: 1,
  total_count: 0,
  per_page: 10,
};

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function SessionStatus({
  session,
}: {
  session?: Assessment["latest_session"];
}) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        No sessions
      </span>
    );
  }

  if (session.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Awaiting candidate
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live now
      </span>
    );
  }

  if (session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Last: failed
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Last: ended
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {formatStatus(session.status)}
    </span>
  );
}

export default function AssessmentListPage() {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<AssessmentsMeta>(initialMeta);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [assessmentToDelete, setAssessmentToDelete] =
    useState<Assessment | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(
    null
  );

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

    const loadAssessments = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await assessmentsApi.list(
          page,
          debouncedSearch
        );

        if (cancelled) {
          return;
        }

        setAssessments(response.data.assessments);
        setMeta(response.data.meta);
      } catch (requestError) {
        console.error(
          "Failed to load assessments:",
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

    void loadAssessments();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, reloadKey]);

  const handleDelete = async () => {
    if (!assessmentToDelete || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await assessmentsApi.delete(assessmentToDelete.id);

      setAssessmentToDelete(null);

      toast.success("Assessment deleted successfully.");

      if (assessments.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch (requestError: unknown) {
      const message = getApiErrorMessage(
        requestError,
        "Failed to delete assessment."
      );

      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const startItem =
    meta.total_count === 0
      ? 0
      : (meta.current_page - 1) * meta.per_page + 1;

  const endItem = Math.min(
    meta.current_page * meta.per_page,
    meta.total_count
  );

  const openAssessment = (id: number) => {
    navigate(`/assessments/${id}/invite`);
  };

  const openDeleteDialog = (assessment: Assessment) => {
    setDeleteError(null);
    setAssessmentToDelete(assessment);
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Assessment management
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Assessments
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create and manage your interview assessments.
          </p>
        </div>

        <Button
          onClick={() => navigate("/assessments/new")}
          className="h-11 rounded-xl px-5 shadow-sm shadow-primary/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      <AssessmentStatistics
        totalAssessments={error ? null : meta.total_count}
        sessionCounts={
          error ? undefined : meta.session_counts
        }
        loading={loading}
        isSearching={Boolean(debouncedSearch)}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-5 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                All Assessments
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Find an assessment and manage its interviews.
              </p>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              {loading || error ? "—" : meta.total_count}{" "}
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
              placeholder="Search assessments..."
              aria-label="Search assessments"
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
              Unable to load assessments
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Please try again.
            </p>

            <Button
              variant="outline"
              className="mt-5 rounded-xl"
              onClick={() =>
                setReloadKey((current) => current + 1)
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
                className="h-14 rounded-xl"
              />
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {debouncedSearch ? (
                <Search className="h-7 w-7" />
              ) : (
                <ClipboardList className="h-7 w-7" />
              )}
            </div>

            <p className="text-base font-bold text-slate-900">
              {debouncedSearch
                ? "No assessments found"
                : "No assessments yet"}
            </p>

            <p className="mt-2 max-w-sm text-sm text-slate-500">
              {debouncedSearch
                ? `No results match "${debouncedSearch}".`
                : "Create your first assessment to start managing interviews."}
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
                  navigate("/assessments/new")
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Assessment
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Assessment
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Duration
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Latest session
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {assessments.map((assessment) => (
                    <tr
                      key={assessment.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ClipboardList className="h-5 w-5" />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openAssessment(assessment.id)
                            }
                            className="text-left text-sm font-semibold text-slate-800 hover:text-primary hover:underline"
                          >
                            {assessment.name}
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          {assessment.time_limit_min} min
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <SessionStatus
                          session={
                            assessment.latest_session
                          }
                        />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() =>
                              openAssessment(assessment.id)
                            }
                          >
                            Open
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${assessment.name}`}
                            title="Delete assessment"
                            className="h-9 w-9 rounded-lg p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              openDeleteDialog(assessment)
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
              {assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="space-y-4 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {assessment.name}
                      </p>

                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {assessment.time_limit_min} min
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${assessment.name}`}
                      className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-red-600"
                      onClick={() =>
                        openDeleteDialog(assessment)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SessionStatus
                      session={
                        assessment.latest_session
                      }
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() =>
                        openAssessment(assessment.id)
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
        open={Boolean(assessmentToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setAssessmentToDelete(null);
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
              Delete assessment?
            </DialogTitle>

            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-800">
                {assessmentToDelete?.name}
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
                setAssessmentToDelete(null);
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
              Delete Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
