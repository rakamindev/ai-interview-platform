import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import type { FitGapReport, Portfolio } from "@/types";

export const useFitGapReportPage = () => {
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio || !vacancyId) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
          setFetchError("Failed to start report generation. Please try again.");
        }
      } else {
        setGenerating(false);
        setFetchError("Failed to load fit/gap report. Please try again.");
      }
    }
  }, [portfolio, vacancyId]);

  const refetchData = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    setFetchError(null);
    setExportError(null);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setFetchError("Could not find the portfolio for this session.");
        }
      })
      .catch(() => {
        setFetchError("Failed to load initial data. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    refetchData();
  }, [refetchData]);

  useEffect(() => {
    if (portfolio) {
      if (fetchError) setFetchError(null);
      fetchReport();
    }
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio || !vacancyId) return;
    setRegenerating(true);
    setFetchError(null);
    setExportError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch {
      setFetchError("Failed to regenerate report. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !sessionId || !vacancyId) return;
    setExporting(format);
    setExportError(null);
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
    } catch {
      setExportError("Failed to export report. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return {
    id,
    sessionId,
    report,
    portfolio,
    generating,
    loading,
    exporting,
    regenerating,
    handleRegenerate,
    handleExport,
    fetchError,
    exportError,
    refetchData,
  };
};