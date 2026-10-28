
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({
  session,
}: {
  session?: Assessment["latest_session"];
}) {
  if (!session) return null;

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live now
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Last session failed
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        Last session completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      Awaiting candidate
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const res = await assessmentsApi.list();
      setAssessments(res.data.assessments);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  const createAssessment = () => navigate("/assessments/new");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#01858e]">
            <ClipboardList className="h-4 w-4" />
            Assessment workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Assessments
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Manage your assessments and review the latest candidate session
            activity.
          </p>
        </div>

        <Button
          onClick={createAssessment}
          className="h-11 w-full rounded-xl bg-[#01959f] px-5 font-semibold text-white shadow-sm transition-colors hover:bg-[#017f87] sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </section>

      {!loading && !error && assessments.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <p className="text-sm font-medium text-slate-700">
            Your assessments
          </p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {assessments.length}{" "}
            {assessments.length === 1 ? "assessment" : "assessments"}
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-900">
                Unable to load assessments
              </p>
              <p className="mt-1 text-sm leading-5 text-red-700">
                Something went wrong while retrieving your data. Please try
                again.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadAssessments()}
            className="shrink-0 rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-label="Loading assessments">
          {[1, 2, 3].map((item) => (
            <Card
              key={item}
              className="rounded-2xl border-slate-200 shadow-sm"
            >
              <CardContent className="flex items-center gap-4 p-5">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5 max-w-64" />
                  <Skeleton className="h-3 w-1/3 max-w-44" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !error && assessments.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-slate-300 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center sm:py-16">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#01959f]">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              No assessments yet
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Create your first assessment to get started with candidate
              interviews.
            </p>
            <Button
              onClick={createAssessment}
              className="mt-6 h-10 rounded-xl bg-[#01959f] px-4 text-white hover:bg-[#017f87]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first assessment
            </Button>
          </CardContent>
        </Card>
      ) : !error ? (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <Card
              key={assessment.id}
              role="button"
              tabIndex={0}
              aria-label={`Open assessment ${assessment.name}`}
              onClick={() =>
                navigate(`/assessments/${assessment.id}/invite`)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/assessments/${assessment.id}/invite`);
                }
              }}
              className="group cursor-pointer rounded-2xl border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01959f] focus-visible:ring-offset-2"
            >
              <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors group-hover:bg-teal-50 group-hover:text-[#01959f]">
                  <ClipboardList className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-sm font-semibold leading-5 text-slate-900 sm:text-base">
                    {assessment.name}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {assessment.time_limit_min} min
                    </span>

                    {assessment.latest_session && (
                      <SessionSummary session={assessment.latest_session} />
                    )}
                  </div>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors group-hover:bg-teal-50 group-hover:text-[#01959f]">
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
