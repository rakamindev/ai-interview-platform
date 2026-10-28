import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";

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

import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Zap,
  FileJson,
  FileText,
} from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const res = await portfoliosApi.getFitGap(
        portfolio.id,
        Number(vacancyId),
      );

      setReport(res.data.report);
      setGenerating(false);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(
            portfolio.id,
            Number(vacancyId),
          );

          setGenerating(true);
          setError(null);
        } catch {
          setGenerating(false);
          setError("Laporan gagal dibuat. Silakan coba lagi.");
        }
      } else {
        setError("Laporan gagal dimuat. Periksa koneksi lalu coba lagi.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    let active = true;

    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        if (!active) return;

        const data = res.data as any;

        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setError("Portfolio kandidat tidak ditemukan.");
        }
      })
      .catch(() => {
        if (active) {
          setError("Portfolio kandidat gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) {
      void fetchReport();
    }
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio || regenerating || generating) return;

    setRegenerating(true);
    setError(null);

    try {
      await portfoliosApi.regenerateFitGap(
        portfolio.id,
        Number(vacancyId),
      );

      setReport(null);
      setGenerating(true);
    } catch {
      setError("Laporan gagal dibuat ulang. Silakan coba lagi.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || exporting) return;

    setExporting(format);
    setError(null);

    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId),
      );

      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], {
              type: "application/pdf",
            })
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `fitgap-${sessionId}-${vacancyId}.${format}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(
        `Gagal mengekspor laporan ${format.toUpperCase()}. Silakan coba lagi.`,
      );
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            aria-label="Kembali ke portfolio kandidat"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Fit/Gap Report
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ringkasan kecocokan kompetensi kandidat dengan kebutuhan posisi.
            </p>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              {regenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate
            </Button>

            {report && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  PDF
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson className="mr-2 h-4 w-4" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>{error}</p>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              if (portfolio) void fetchReport();
            }}
            className="w-fit border-red-200 bg-white hover:bg-red-100"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Generating State */}
      {generating && (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>

            <h2 className="mt-4 font-semibold">
              Generating Fit/Gap Report
            </h2>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Laporan sedang diproses. Halaman akan diperbarui secara otomatis
              ketika hasilnya tersedia.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="text-base">
                Skill Comparison
              </CardTitle>

              <p className="text-sm text-muted-foreground">
                Bandingkan level kompetensi kandidat dengan persyaratan posisi.
              </p>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Additional Skills */}
          {portfolio?.skills.some((skill) => skill.is_discovered) && (
            <>
              <Separator />

              <Card>
                <CardHeader className="px-4 py-4 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Zap className="h-4 w-4" />
                    </div>

                    <div>
                      <CardTitle className="text-base">
                        Additional Skills
                      </CardTitle>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Kompetensi tambahan yang ditemukan di luar persyaratan
                        posisi.
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
                  {portfolio.skills
                    .filter((skill) => skill.is_discovered)
                    .map((skill) => (
                      <div
                        key={skill.id}
                        className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm font-medium">
                          {skill.skill_label}
                        </span>

                        <span className="text-sm text-muted-foreground">
                          {skill.ai_level} ·{" "}
                          {skill.ai_confidence?.toLowerCase() === "low"
                            ? "Kepercayaan AI rendah"
                            : "Terkonfirmasi"}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {!report && !generating && !error && (
        <Card>
          <CardContent className="px-6 py-12 text-center">
            <h2 className="font-semibold">Report not available</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Laporan belum tersedia untuk kandidat dan posisi ini.
            </p>

            {portfolio && (
              <Button
                className="mt-4"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate report
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
