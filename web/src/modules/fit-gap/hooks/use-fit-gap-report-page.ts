import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fitGapApi, PortfolioNotReadyError } from "../api/fit-gap.api";
import { fitGapQueryKeys } from "../api/fit-gap-query-keys";
import { parsePositiveInteger, summarizeComparisons } from "../lib/fit-gap";
import type {
  FitGapExportFormat,
  FitGapReport,
  FitGapRouteIds,
} from "../types/fit-gap.types";

interface FitGapRouteParams {
  assessmentId?: string;
  sessionId?: string;
  vacancyId?: string;
}

interface ExportRequest {
  format: FitGapExportFormat;
  portfolioId: number;
  vacancyId: number;
  sessionId: number;
}

function parseRouteIds(params: FitGapRouteParams): FitGapRouteIds | null {
  const assessmentId = parsePositiveInteger(params.assessmentId);
  const sessionId = parsePositiveInteger(params.sessionId);
  const vacancyId = parsePositiveInteger(params.vacancyId);

  if (!assessmentId || !sessionId || !vacancyId) return null;
  return { assessmentId, sessionId, vacancyId };
}

function downloadExport(data: unknown, request: ExportRequest) {
  const blob =
    request.format === "pdf" && data instanceof Blob
      ? data
      : new Blob(
          [request.format === "json" ? JSON.stringify(data, null, 2) : (data as BlobPart)],
          { type: request.format === "pdf" ? "application/pdf" : "application/json" },
        );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fitgap-${request.sessionId}-${request.vacancyId}.${request.format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function queryErrorMessage(error: unknown, fallback: string): string | null {
  if (!error) return null;
  if (error instanceof PortfolioNotReadyError) return error.message;
  return fallback;
}

export function useFitGapReportPage(params: FitGapRouteParams) {
  const queryClient = useQueryClient();
  const routeIds = useMemo(
    () => parseRouteIds(params),
    [params.assessmentId, params.sessionId, params.vacancyId],
  );
  const sessionId = routeIds?.sessionId ?? 0;
  const vacancyId = routeIds?.vacancyId ?? 0;

  const contextQuery = useQuery({
    queryKey: fitGapQueryKeys.context(sessionId, vacancyId),
    queryFn: ({ signal }) => fitGapApi.getContext(sessionId, vacancyId, signal),
    enabled: routeIds !== null,
  });

  const portfolioId = contextQuery.data?.portfolio.id ?? 0;
  const reportKey = fitGapQueryKeys.report(portfolioId, vacancyId);
  const reportQuery = useQuery({
    queryKey: reportKey,
    queryFn: ({ signal }) => fitGapApi.ensureReport(portfolioId, vacancyId, signal),
    enabled: routeIds !== null && portfolioId > 0,
    retry: false,
    staleTime: 0,
    refetchInterval: (query) => {
      const report = query.state.data as FitGapReport | null | undefined;
      if (report === undefined) return false;
      if (report === null) return 3_000;
      return report.generation_status === "pending" ||
        report.generation_status === "generating"
        ? 3_000
        : false;
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => fitGapApi.regenerate(portfolioId, vacancyId),
    onSuccess: async () => {
      queryClient.setQueryData(reportKey, null);
      await queryClient.invalidateQueries({ queryKey: reportKey });
    },
  });

  const exportMutation = useMutation({
    mutationFn: (request: ExportRequest) =>
      fitGapApi.exportReport(request.portfolioId, request.vacancyId, request.format),
    onSuccess: (response, request) => downloadExport(response.data, request),
  });

  const report = reportQuery.data ?? null;
  const reviewSummary = useMemo(() => {
    if (!report) return null;
    return report.review_summary ?? summarizeComparisons(report.skill_comparisons);
  }, [report]);

  const requestError =
    (routeIds === null ? "This review URL is invalid." : null) ??
    queryErrorMessage(contextQuery.error, "We could not load this candidate review.") ??
    queryErrorMessage(reportQuery.error, "We could not refresh this report. Check your connection and try again.") ??
    queryErrorMessage(regenerateMutation.error, "Regeneration could not be started. Please try again.") ??
    queryErrorMessage(
      exportMutation.error,
      `The ${exportMutation.variables?.format.toUpperCase() ?? "requested"} export could not be created.`,
    );

  const retry = () => {
    regenerateMutation.reset();
    exportMutation.reset();
    if (contextQuery.isError) {
      void contextQuery.refetch();
      return;
    }
    void reportQuery.refetch();
  };

  const regenerate = () => {
    if (!routeIds || portfolioId === 0) return;
    regenerateMutation.reset();
    exportMutation.reset();
    regenerateMutation.mutate();
  };

  const exportReport = (format: FitGapExportFormat) => {
    if (!routeIds || portfolioId === 0) return;
    exportMutation.reset();
    exportMutation.mutate({
      format,
      portfolioId,
      vacancyId: routeIds.vacancyId,
      sessionId: routeIds.sessionId,
    });
  };

  const isInitialLoading =
    routeIds !== null &&
    (contextQuery.isPending || (contextQuery.isSuccess && reportQuery.isPending));
  const isGenerating =
    reportQuery.isSuccess &&
    (report === null ||
      report.generation_status === "pending" ||
      report.generation_status === "generating");

  return {
    backToPortfolioUrl: routeIds
      ? `/assessments/${routeIds.assessmentId}/sessions/${routeIds.sessionId}/portfolio`
      : "/assessments",
    candidateName: contextQuery.data?.candidateName ?? null,
    vacancy: contextQuery.data?.vacancy ?? null,
    portfolio: contextQuery.data?.portfolio ?? null,
    report,
    reviewSummary,
    requestError,
    canRegenerate: routeIds !== null && portfolioId > 0,
    canRetry: routeIds !== null,
    isInitialLoading,
    isGenerating,
    isFailed: report?.generation_status === "failed",
    isReady: report?.generation_status === "complete",
    isRegenerating: regenerateMutation.isPending,
    exportingFormat: exportMutation.isPending
      ? (exportMutation.variables?.format ?? null)
      : null,
    retry,
    regenerate,
    exportReport,
  };
}
