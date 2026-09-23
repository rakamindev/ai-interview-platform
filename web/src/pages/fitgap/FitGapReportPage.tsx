import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import PageHeader from "@/components/layout/PageHeader";
import StatePanel from "@/components/layout/StatePanel";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        back={
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground mt-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
        title="Fit/Gap Report"
        subtitle="Vacancy requirements vs candidate portfolio"
        actions={
          portfolio ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Regenerate
              </Button>
              {report && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                    {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                    {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    JSON
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      />

      {generating && (
        <StatePanel
          variant="generating"
          title="Generating fit/gap report"
          description="Comparing portfolio levels against vacancy expectations."
        >
          <Skeleton className="h-32 w-full" />
        </StatePanel>
      )}

      {report && (
        <>
          <section className="border border-foreground/10 bg-card/50 px-3 sm:px-4 py-4 space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight px-1">Skill comparison</h2>
            <ComparisonTable comparisons={report.skill_comparisons} />
          </section>

          <section className="border border-foreground/10 bg-card/50 px-4 sm:px-5 py-5 space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Culture &amp; competency</h2>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {report.culture_narrative || report.overall_narrative}
            </p>
          </section>

          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <section className="border border-foreground/10 bg-card/50 px-4 sm:px-5 py-5 space-y-3">
              <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                Discovered skills
              </h2>
              <p className="text-xs text-muted-foreground -mt-1">Not in vacancy requirements — may be additive.</p>
              <ul className="space-y-2">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((s) => (
                    <li key={s.id} className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium">{s.skill_label}</span>
                      <span className="text-muted-foreground text-xs">
                        L{s.ai_level}
                        {s.ai_confidence?.toLowerCase() === "low" ? " · low confidence" : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
