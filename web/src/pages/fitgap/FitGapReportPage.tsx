
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import type { FitGapReport, Portfolio } from "@/types";

function isReportRunning(report: FitGapReport | null) {
  return (
    report?.generation_status === "queued" ||
    report?.generation_status === "generating" ||
    report?.generation_status === "stale"
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  const candidate = error as {
    response?: { data?: { errors?: Array<{ message?: string }> } };
  };

  return candidate?.response?.data?.errors?.[0]?.message || fallback;
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  const portfolioReady = portfolio?.generation_status === "complete";
  const generating = isReportRunning(report);
  const hasSavedComparison = Boolean(
    report?.generated_at && report.skill_comparisons,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPortfolio() {
      setLoading(true);
      setPageError(null);

      try {
        const response = await sessionsApi.getPortfolio(Number(sessionId));
        const data = response.data as {
          portfolio?: Portfolio;
          status?: string;
        };

        if (!data.portfolio) {
          throw new Error(
            data.status === "generating"
              ? "The candidate portfolio is still being generated."
              : "The candidate portfolio is not available.",
          );
        }

        if (!cancelled) setPortfolio(data.portfolio);
      } catch (error) {
        if (!cancelled) {
          setPageError(
            getErrorMessage(
              error,
              "Could not load the candidate portfolio. Please retry.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPortfolio();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const requestReport = useCallback(async () => {
    if (!portfolio) return;

    setRequesting(true);
    setReportError(null);

    try {
      const response = await portfoliosApi.triggerFitGap(
        portfolio.id,
        Number(vacancyId),
      );

      setReport(response.data.report);
      setPageError(null);
    } catch (error) {
      setReportError(
        getErrorMessage(error, "The fit/gap report could not be requested."),
      );
    } finally {
      setRequesting(false);
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    if (!portfolioReady || !portfolio) return;

    const loadedPortfolio = portfolio;
    let cancelled = false;

    async function loadOrCreateReport() {
      setRequesting(true);
      setReportError(null);

      try {
        const response = await portfoliosApi.getFitGap(
          loadedPortfolio.id,
          Number(vacancyId),
        );

        if (!cancelled) setReport(response.data.report);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;

        if (status === 404) {
          try {
            const response = await portfoliosApi.triggerFitGap(
              loadedPortfolio.id,
              Number(vacancyId),
            );

            if (!cancelled) setReport(response.data.report);
          } catch (requestError) {
            if (!cancelled) {
              setReportError(
                getErrorMessage(
                  requestError,
                  "The fit/gap report could not be generated.",
                ),
              );
            }
          }
        } else if (!cancelled) {
          setReportError(
            getErrorMessage(error, "Could not load the fit/gap report."),
          );
        }
      } finally {
        if (!cancelled) setRequesting(false);
      }
    }

    void loadOrCreateReport();

    return () => {
      cancelled = true;
    };
  }, [portfolioReady, portfolio, vacancyId]);

  const pollReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const response = await portfoliosApi.getFitGap(
        portfolio.id,
        Number(vacancyId),
      );

      setReport(response.data.report);
      setReportError(null);
    } catch (error) {
      setReportError(
        getErrorMessage(
          error,
          "The report status could not be refreshed. Retrying automatically.",
        ),
      );
    }
  }, [portfolio, vacancyId]);

  usePolling(pollReport, 4000, generating && Boolean(portfolio));

  const handleRegenerate = async () => {
    if (!portfolio) return;

    setRegenerating(true);
    setReportError(null);

    try {
      const response = await portfoliosApi.regenerateFitGap(
        portfolio.id,
        Number(vacancyId),
      );

      setReport(response.data.report);
    } catch (error) {
      setReportError(
        getErrorMessage(
          error,
          "Regeneration could not be started. Your saved report has not been removed.",
        ),
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || report?.generation_status !== "complete") return;

    setExporting(format);
    setReportError(null);

    try {
      const response = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId),
      );

      const blob =
        format === "pdf"
          ? new Blob([response.data as BlobPart], {
              type: "application/pdf",
            })
          : new Blob([JSON.stringify(response.data, null, 2)], {
              type: "application/json",
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReportError(
        getErrorMessage(
          error,
          `The ${format.toUpperCase()} export failed. Please retry.`,
        ),
      );
    } finally {
      setExporting(null);
    }
  };

  const backLink = `/assessments/${id}/sessions/${sessionId}/portfolio`;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-3 sm:px-5">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (pageError || !portfolio) {
    return (
      <div className="mx-auto w-full max-w-2xl min-w-0 space-y-4 px-3 sm:px-5">
        <Link
          to={backLink}
          className="inline-flex max-w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to portfolio</span>
        </Link>

        <Card className="min-w-0">
          <CardContent className="flex min-w-0 flex-col items-center gap-3 p-4 text-center sm:p-8">
            <AlertCircle
              className="h-8 w-8 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <h1 className="font-semibold">Portfolio unavailable</h1>
            <p className="max-w-md break-words text-sm text-muted-foreground">
              {pageError ||
                "The candidate portfolio could not be loaded."}
            </p>
            <Button
              variant="outline"
              className="max-w-full"
              onClick={() => window.location.reload()}
            >
              Retry loading
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portfolioReady) {
    return (
      <div className="mx-auto w-full max-w-2xl min-w-0 space-y-4 px-3 sm:px-5">
        <Link
          to={backLink}
          className="inline-flex max-w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to portfolio</span>
        </Link>

        <Card className="min-w-0">
          <CardContent className="flex min-w-0 flex-col items-center gap-3 p-4 text-center sm:p-8">
            {portfolio.generation_status === "failed" ? (
              <AlertCircle
                className="h-8 w-8 shrink-0 text-destructive"
                aria-hidden="true"
              />
            ) : (
              <Loader2
                className="h-8 w-8 shrink-0 animate-spin text-primary"
                aria-hidden="true"
              />
            )}

            <h1 className="break-words font-semibold">
              {portfolio.generation_status === "failed"
                ? "Portfolio generation failed"
                : "Portfolio is still generating"}
            </h1>

            <p className="max-w-md break-words text-sm text-muted-foreground">
              {portfolio.generation_status === "failed"
                ? "Fit/gap analysis needs a completed portfolio. Retry portfolio generation from the portfolio page."
                : "The comparison will be available when the candidate portfolio is complete."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6 px-3 pb-8 sm:space-y-8 sm:px-5">
      <header className="flex min-w-0 flex-col gap-4 border-b pb-5 sm:gap-5 sm:pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <Link
            to={backLink}
            className="inline-flex max-w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to candidate portfolio</span>
          </Link>

          <div className="min-w-0">
            <p className="break-words text-xs font-semibold uppercase tracking-[0.12em] text-primary sm:tracking-[0.16em]">
              Assessment workspace / Decision support
            </p>

            <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              Fit/gap analysis
            </h1>

            <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground">
              Compare the candidate&apos;s documented evidence with the
              requirements for this role. Review the source evidence before
              making a hiring decision.
            </p>
          </div>
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto lg:max-w-[22rem] lg:grid-cols-1 lg:justify-items-stretch">
          <Button
            variant="outline"
            size="sm"
            className="w-full min-w-0"
            onClick={handleRegenerate}
            disabled={regenerating || generating || requesting}
          >
            {regenerating || generating ? (
              <Loader2
                className="mr-2 h-4 w-4 shrink-0 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RefreshCw
                className="mr-2 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="truncate">Refresh analysis</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full min-w-0"
            onClick={() => void handleExport("pdf")}
            disabled={
              report?.generation_status !== "complete" || Boolean(exporting)
            }
          >
            {exporting === "pdf" ? (
              <Loader2
                className="mr-2 h-4 w-4 shrink-0 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download
                className="mr-2 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span>Export PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full min-w-0"
            onClick={() => void handleExport("json")}
            disabled={
              report?.generation_status !== "complete" || Boolean(exporting)
            }
          >
            {exporting === "json" ? (
              <Loader2
                className="mr-2 h-4 w-4 shrink-0 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download
                className="mr-2 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span>Export JSON</span>
          </Button>
        </div>
      </header>

      {reportError && (
        <div
          role="alert"
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-start sm:p-4"
        >
          <AlertCircle
            className="h-4 w-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">There is a problem with the report</p>
            <p className="mt-1 break-words text-muted-foreground">
              {reportError}
            </p>
          </div>

          {!report && (
            <Button
              size="sm"
              variant="outline"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => void requestReport()}
              disabled={requesting}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {requesting && !report && (
        <div
          role="status"
          className="flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm text-muted-foreground sm:p-4"
        >
          <Loader2
            className="mt-0.5 h-4 w-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <span className="min-w-0 break-words">
            Requesting the first report...
          </span>
        </div>
      )}

      {!report && !requesting && !reportError && (
        <Card className="min-w-0">
          <CardContent className="flex min-w-0 flex-col items-center gap-3 p-4 text-center sm:p-8">
            <Sparkles
              className="h-8 w-8 shrink-0 text-primary"
              aria-hidden="true"
            />
            <h2 className="font-semibold">No report yet</h2>
            <p className="max-w-md break-words text-sm text-muted-foreground">
              Start an analysis to compare vacancy requirements with the
              evidence saved in this portfolio.
            </p>
            <Button
              className="w-full sm:w-auto"
              onClick={() => void requestReport()}
              disabled={requesting}
            >
              {requesting ? "Requesting..." : "Generate fit/gap report"}
            </Button>
          </CardContent>
        </Card>
      )}

      {report && generating && (
        <div
          role="status"
          className="flex min-w-0 items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:p-4"
        >
          <Loader2
            className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">
              {hasSavedComparison
                ? "Refreshing analysis"
                : "Generating fit/gap report"}
            </p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {hasSavedComparison
                ? "The last saved comparison remains available while the newer version is prepared."
                : "Structured comparison is calculated from saved skill levels; the AI narrative is generated separately."}
            </p>
          </div>
        </div>
      )}

      {report?.generation_status === "failed" && (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-destructive/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">Latest refresh failed</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {report.generation_error ||
                  "The saved report was not replaced. Retry to request a new version."}
                {hasSavedComparison
                  ? " The previous saved comparison is still shown below."
                  : ""}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void handleRegenerate()}
            disabled={regenerating}
          >
            <RefreshCw className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            Retry generation
          </Button>
        </div>
      )}

      {report && report.generation_status === "complete" && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>Report ready</span>
          {report.generated_at && (
            <span className="break-words">
              · Last generated{" "}
              {new Date(report.generated_at).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {report && report.skill_comparisons.length > 0 && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="gap-2 pb-3 sm:pb-4">
            <CardTitle className="break-words text-base sm:text-lg">
              Skill comparison
            </CardTitle>
            <p className="break-words text-sm leading-6 text-muted-foreground">
              Each requirement is compared independently. “Not assessed” means
              the portfolio does not contain usable candidate evidence for that
              skill.
            </p>
          </CardHeader>

          <CardContent className="min-w-0 px-3 pb-5 sm:px-6">
            <div className="w-full min-w-0 overflow-x-auto">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </div>
          </CardContent>
        </Card>
      )}

      {report &&
        report.skill_comparisons.length === 0 &&
        !generating && (
          <Card className="min-w-0">
            <CardContent className="min-w-0 p-4 sm:p-6">
              <p className="break-words font-medium">
                No skill requirements are included in this report.
              </p>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Review the vacancy skill configuration. You can refresh the
                analysis after correcting the requirements.
              </p>
            </CardContent>
          </Card>
        )}

      {report && (report.culture_narrative || report.overall_narrative) && (
        <>
          <Separator />

          <section
            aria-labelledby="culture-narrative-heading"
            className="min-w-0 space-y-3"
          >
            <div className="min-w-0">
              <h2
                id="culture-narrative-heading"
                className="break-words text-base font-semibold"
              >
                Culture and competency context
              </h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                AI-generated context is supplementary and should be checked
                against the structured comparison.
              </p>
            </div>

            <Card className="min-w-0">
              <CardContent className="min-w-0 space-y-4 p-4 sm:p-6">
                {report.culture_narrative && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">
                      Culture fit context
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                      {report.culture_narrative}
                    </p>
                  </div>
                )}

                {report.culture_narrative && report.overall_narrative && (
                  <Separator />
                )}

                {report.overall_narrative && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">
                      Overall evidence summary
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                      {report.overall_narrative}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {portfolio.skills.some((skill) => skill.is_discovered) && (
        <>
          <Separator />

          <section
            aria-labelledby="discovered-skills-heading"
            className="min-w-0 space-y-3"
          >
            <div className="min-w-0">
              <h2
                id="discovered-skills-heading"
                className="flex min-w-0 items-start gap-2 text-base font-semibold"
              >
                <Zap
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                  aria-hidden="true"
                />
                <span className="break-words">
                  Additional discovered skills
                </span>
              </h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                These skills were found during the interview and are not part
                of this vacancy&apos;s configured requirements.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.skills
                .filter((skill) => skill.is_discovered)
                .map((skill) => (
                  <Card key={skill.id} className="min-w-0">
                    <CardContent className="min-w-0 p-4">
                      <p className="break-words text-sm font-medium">
                        {skill.skill_label}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="break-words">{skill.ai_level}</span>
                        <span aria-hidden="true">·</span>
                        <span className="break-words">
                          {skill.ai_confidence} confidence
                        </span>
                      </div>

                      <p className="mt-2 break-words text-sm text-muted-foreground">
                        {skill.competency_summary}
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        </>
      )}

      <div className="min-w-0 rounded-xl border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground sm:p-5">
        <div className="flex min-w-0 items-start gap-2">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p className="min-w-0 break-words">
            Decision support only. A skill gap or missing assessment evidence
            is not, by itself, a hiring decision. Review candidate-authored
            evidence and assessor overrides before drawing conclusions.
          </p>
        </div>
      </div>
    </div>
  );
}
