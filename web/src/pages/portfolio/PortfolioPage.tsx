
import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{
    id: string;
    sessionId: string;
  }>();
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<
    Record<number, AssessorOverride>
  >({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;

    if (
      data.status === "generating" ||
      data.portfolio?.generation_status === "generating" ||
      data.portfolio?.generation_status === "pending"
    ) {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);

      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() =>
        setPageError("Portfolio gagal dimuat. Coba muat ulang halaman."),
      )
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (
    skillId: number,
    override: AssessorOverride,
  ) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(
      `/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`,
    );
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;

    setExporting(format);
    setExportError(null);

    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined,
      );

      const blob =
        format === "json"
          ? new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            })
          : new Blob([res.data as BlobPart], {
              type: "application/pdf",
            });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export gagal. Silakan coba lagi.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-3 sm:px-5">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 sm:px-5">
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 px-4 py-8 text-center"
        >
          <AlertCircle
            className="h-7 w-7 text-destructive"
            aria-hidden="true"
          />
          <h1 className="font-semibold">Portfolio tidak tersedia</h1>
          <p className="text-sm text-muted-foreground">{pageError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Muat ulang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-3 pb-6 sm:space-y-6 sm:px-5">
      <header className="flex min-w-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0"
            asChild
          >
            <Link
              to={`/assessments/${id}/invite`}
              aria-label="Kembali ke kandidat"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Portfolio results
            </h1>
            {candidateName && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {candidateName}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 px-2 sm:px-3"
            asChild
          >
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              aria-label="Buka transcript"
            >
              <FileText className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Transcript</span>
            </Link>
          </Button>

          {!generating && portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="min-w-0 px-2 sm:px-3"
                onClick={() => void handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Download className="mr-1 h-3.5 w-3.5 shrink-0" />
                )}
                PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="min-w-0 px-2 sm:px-3"
                onClick={() => void handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Download className="mr-1 h-3.5 w-3.5 shrink-0" />
                )}
                JSON
              </Button>
            </>
          )}
        </div>
      </header>

      {generating && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border p-4 sm:p-5"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Generating portfolio...</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Analisis interview sedang diproses.
            </p>
          </div>
        </div>
      )}

      {exportError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p>{exportError}</p>
        </div>
      )}

      {!generating && portfolio?.generation_status === "failed" && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-destructive">
            Portfolio generation failed.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={async () => {
              try {
                await sessionsApi.regeneratePortfolio(Number(sessionId));
                setGenerating(true);
                setPageError(null);
              } catch {
                setPageError("Gagal memulai ulang. Silakan coba lagi.");
              }
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {!generating && portfolio?.generation_status === "complete" && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Skills</h2>

            <div className="space-y-3">
              {portfolio.skills
                .filter((skill) => !skill.is_discovered)
                .map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(override) =>
                      handleOverrideSaved(skill.id, override)
                    }
                  />
                ))}
            </div>
          </section>

          {portfolio.skills.some((skill) => skill.is_discovered) && (
            <>
              <Separator />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                  <h2 className="text-sm font-semibold">Discovered Skills</h2>
                </div>

                <div className="space-y-3">
                  {portfolio.skills
                    .filter((skill) => skill.is_discovered)
                    .map((skill) => (
                      <SkillPortfolioCard
                        key={skill.id}
                        skill={skill}
                        override={overrides[skill.id]}
                        onOverrideSaved={(override) =>
                          handleOverrideSaved(skill.id, override)
                        }
                      />
                    ))}
                </div>
              </section>
            </>
          )}

          <Separator />

          <section className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:p-4">
            <Select
              value={selectedVacancy}
              onValueChange={setSelectedVacancy}
            >
              <SelectTrigger className="w-full min-w-0 sm:flex-1">
                <SelectValue placeholder="Choose vacancy..." />
              </SelectTrigger>

              <SelectContent>
                {vacancies.map((vacancy) => (
                  <SelectItem
                    key={vacancy.id}
                    value={String(vacancy.id)}
                  >
                    {vacancy.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={handleRunFitGap}
              disabled={!selectedVacancy}
            >
              Run Fit/Gap
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
