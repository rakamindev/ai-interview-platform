import { AlertCircle, FileWarning, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FitGapLoadingState() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

export function FitGapRequestError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function FitGapGeneratingState() {
  return (
    <div
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-8 text-center sm:p-12"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-teal-100">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-semibold text-slate-900">
        Comparing role requirements with interview evidence
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
        The skill comparison is deterministic. AI is only drafting the contextual narrative,
        and this page will flag missing or low-confidence evidence for human review.
      </p>
    </div>
  );
}

export function FitGapFailedState({
  error,
  isRegenerating,
  onRegenerate,
}: {
  error?: string;
  isRegenerating: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <FileWarning className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-amber-950">Report generation stopped safely</h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
            {error ??
              "The comparison could not be completed. No partial report will be used for a hiring decision."}
          </p>
          <Button
            className="mt-4"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            Try generation again
          </Button>
        </div>
      </div>
    </div>
  );
}
