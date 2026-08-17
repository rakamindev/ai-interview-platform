import { useParams } from "react-router-dom";

import { FitGapReportContent } from "../components/fit-gap-report-content";
import { FitGapReportHeader } from "../components/fit-gap-report-header";
import {
  FitGapFailedState,
  FitGapGeneratingState,
  FitGapLoadingState,
  FitGapRequestError,
} from "../components/fit-gap-report-states";
import { useFitGapReportPage } from "../hooks/use-fit-gap-report-page";

export function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();
  const page = useFitGapReportPage({ assessmentId: id, sessionId, vacancyId });

  if (page.isInitialLoading) return <FitGapLoadingState />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <FitGapReportHeader
        backToPortfolioUrl={page.backToPortfolioUrl}
        canRegenerate={page.canRegenerate}
        candidateName={page.candidateName}
        exportingFormat={page.exportingFormat}
        isGenerating={page.isGenerating}
        isReady={page.isReady}
        isRegenerating={page.isRegenerating}
        onExport={page.exportReport}
        onRegenerate={page.regenerate}
        roleTitle={page.vacancy?.role_title ?? "Fit / gap report"}
      />

      {page.requestError ? (
        <FitGapRequestError
          message={page.requestError}
          onRetry={page.canRetry ? page.retry : undefined}
        />
      ) : null}

      {page.isGenerating ? <FitGapGeneratingState /> : null}

      {page.isFailed ? (
        <FitGapFailedState
          error={page.report?.generation_error}
          isRegenerating={page.isRegenerating}
          onRegenerate={page.regenerate}
        />
      ) : null}

      {page.isReady && page.report && page.reviewSummary && page.portfolio ? (
        <FitGapReportContent
          portfolio={page.portfolio}
          report={page.report}
          reviewSummary={page.reviewSummary}
        />
      ) : null}
    </div>
  );
}
