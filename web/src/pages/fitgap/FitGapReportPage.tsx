import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams();
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setReport(null);
    setPortfolio(null);
    const load = async () => {
      if (
        ![sessionId, vacancyId].every(
          (value) =>
            value &&
            /^\d+$/.test(value) &&
            Number.isSafeInteger(Number(value)) &&
            Number(value) > 0,
        )
      ) {
        if (active) {
          setError(
            "This comparison link is invalid. Return to the portfolio and select a vacancy.",
          );
          setLoading(false);
        }
        return;
      }
      try {
        const response = await sessionsApi.getPortfolio(Number(sessionId));
        const data = response.data as { portfolio?: Portfolio };
        if (
          !data.portfolio ||
          data.portfolio.generation_status !== "complete"
        ) {
          if (active)
            setError(
              "The portfolio is not ready. Return to the portfolio to check its status, then retry.",
            );
          return;
        }
        const comparison = await portfoliosApi.getFitGap(
          data.portfolio.id,
          Number(vacancyId),
        );
        if (active) {
          setPortfolio(data.portfolio);
          setReport(comparison.data.report);
        }
      } catch {
        if (active)
          setError(
            "We could not load this comparison. Check your connection and access to the portfolio and vacancy, then retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [sessionId, vacancyId, revision]);

  const exportReport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId),
      );
      const blob = new Blob(
        [
          format === "pdf"
            ? response.data
            : JSON.stringify(response.data, null, 2),
        ],
        { type: format === "pdf" ? "application/pdf" : "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fitgap-" + sessionId + "-" + vacancyId + "." + format;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(
        "The export failed. Your comparison is still available. Try the export again.",
      );
    } finally {
      setExporting(null);
    }
  };

  const rows = report?.skill_comparisons ?? [];
  const unassessed = rows.filter((row) => row.result === "not_assessed").length;
  const gaps = rows.filter((row) => row.result === "gap").length;
  const matches = rows.filter(
    (row) => row.result === "match" || row.result === "exceed",
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-7 text-slate-900 [&_button]:min-h-11 [&_button]:focus-visible:ring-2">
      <Link
        to={"/assessments/" + id + "/sessions/" + sessionId + "/portfolio"}
        className="inline-flex min-h-10 items-center gap-2 rounded text-sm text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to portfolio
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Fit/Gap review
          </h1>
          <p className="break-words text-slate-600 [overflow-wrap:anywhere]">
            {report?.role_title ??
              "Compare interview evidence with role requirements."}
          </p>
        </div>
        {report && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-10"
              onClick={() => setRevision((value) => value + 1)}
              disabled={loading || !!exporting}
            >
              <RefreshCw aria-hidden="true" />
              Refresh comparison
            </Button>
            <Button
              variant="outline"
              className="min-h-10"
              onClick={() => void exportReport("pdf")}
              disabled={!!exporting}
            >
              <Download aria-hidden="true" />
              {exporting === "pdf" ? "Exporting PDF..." : "Export PDF"}
            </Button>
            <Button
              variant="outline"
              className="min-h-10"
              onClick={() => void exportReport("json")}
              disabled={!!exporting}
            >
              {exporting === "json" ? "Exporting JSON..." : "Export JSON"}
            </Button>
          </div>
        )}
      </header>
      {loading && (
        <div role="status" aria-live="polite" className="rounded-lg border p-8">
          <p className="font-medium">Loading skill comparison...</p>
          <p className="mt-2 text-sm text-slate-600">
            Checking the latest ratings and vacancy requirements.
          </p>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 space-y-3"
        >
          <h2 className="font-semibold">Comparison unavailable</h2>
          <p className="text-sm leading-relaxed">{error}</p>
          <Button
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry comparison
          </Button>
        </div>
      )}
      {exportError && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
        >
          {exportError}
        </p>
      )}
      {report && (
        <>
          <section
            aria-labelledby="coverage-title"
            className="rounded-lg border bg-slate-50 p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2
                  id="coverage-title"
                  className="text-sm font-medium text-slate-600"
                >
                  Assessment coverage
                </h2>
                <p className="mt-2 text-2xl font-semibold">
                  {rows.length - unassessed} of {rows.length} requirements
                  assessed
                </p>
              </div>
              <Link
                className="inline-flex min-h-10 items-center rounded px-2 text-sm font-medium text-teal-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2"
                to={
                  "/assessments/" +
                  id +
                  "/sessions/" +
                  sessionId +
                  "/transcript"
                }
              >
                Review interview transcript
              </Link>
            </div>
            {rows.length > 0 && (
              <>
                <progress
                  className="mt-4 h-2 w-full appearance-none overflow-hidden rounded bg-slate-200 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-teal-700 [&::-moz-progress-bar]:bg-teal-700"
                  value={rows.length - unassessed}
                  max={rows.length}
                  aria-label="Assessed vacancy requirements"
                />
                <p className="mt-3 text-sm text-slate-700">
                  {matches} meet or exceed requirements · {gaps} below
                  requirement · {unassessed} not assessed
                </p>
              </>
            )}
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Missing assessment is not a skill gap. This comparison supports
              human review and does not make a hiring recommendation.
            </p>
          </section>
          <ComparisonTable key={report.vacancy_id} comparisons={rows} />
          <section className="border-t pt-6 space-y-2">
            <h2 className="font-semibold">
              Culture and competency need separate review
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              Skill levels alone do not establish culture fit. Review behavioral
              evidence and the role context with an assessor before drawing a
              conclusion.
            </p>
          </section>
          <details className="rounded-lg border p-4 text-sm">
            <summary className="cursor-pointer rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              How this comparison works
            </summary>
            <div className="mt-3 space-y-2 leading-relaxed text-slate-600">
              <p>
                Skills match by canonical ID first. Custom skills use an
                unambiguous normalized label. The assessor override takes
                precedence; otherwise the AI rating is used. Difference equals
                assessed level minus required level.
              </p>
              <p>
                Missing, invalid, or ambiguous ratings remain unassessed. No
                model is called to calculate this report.
              </p>
              <p>Updated: {new Date(report.generated_at).toLocaleString()}</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
