
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
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  BriefcaseBusiness,
  AlertCircle,
  ClipboardCheck,
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
  const [retryError, setRetryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<
    Record<number, AssessorOverride>
  >({});

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;

    const isGenerating =
      data.status === "generating" ||
      data.portfolio?.generation_status === "generating" ||
      data.portfolio?.generation_status === "pending";

    if (isGenerating) {
      setGenerating(true);
      return;
    }

    if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);

      const overrideMap: Record<number, AssessorOverride> = {};

      (data.portfolio.overrides ?? []).forEach(
        (override: AssessorOverride) => {
          overrideMap[override.portfolio_skill_id] = override;
        }
      );

      setOverrides(overrideMap);
    } else {
      setGenerating(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([, vacancyResponse, sessionResponse]) => {
        if (!active) return;

        setVacancies(vacancyResponse.data.vacancies ?? []);
        setCandidateName(
          sessionResponse.data.session.candidate_name ?? null
        );
        setPageError(null);
      })
      .catch(() => {
        if (active) {
          setPageError(
            "Data portofolio belum dapat dimuat. Periksa koneksi lalu coba lagi."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchPortfolio, sessionId]);

  usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (
    skillId: number,
    override: AssessorOverride
  ) => {
    setOverrides((previous) => ({
      ...previous,
      [skillId]: override,
    }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;

    navigate(
      `/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`
    );
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;

    setExporting(format);

    try {
      const response = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );

      const blob =
        format === "json"
          ? new Blob([JSON.stringify(response.data, null, 2)], {
              type: "application/json",
            })
          : new Blob([response.data as BlobPart], {
              type: "application/pdf",
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `portfolio-${sessionId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setRetryError(
        `Ekspor ${format.toUpperCase()} gagal. Silakan coba lagi.`
      );
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const configuredSkills =
    portfolio?.skills.filter((skill) => !skill.is_discovered) ?? [];

  const discoveredSkills =
    portfolio?.skills.filter((skill) => skill.is_discovered) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 pb-10 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="space-y-5">
        <Link
          to={`/assessments/${id}/invite`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar kandidat
        </Link>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">
              HASIL PENILAIAN
            </p>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Hasil Portofolio
            </h1>

            <p className="text-base text-muted-foreground">
              Kandidat:{" "}
              <span className="font-medium text-foreground">
                {candidateName || "Nama belum tersedia"}
              </span>
            </p>

            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Tinjau kemampuan kandidat berdasarkan wawancara dan sesuaikan
              level jika diperlukan.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link
                to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              >
                <FileText className="mr-2 h-4 w-4" />
                Transkrip
              </Link>
            </Button>

            {!generating && portfolio && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  PDF
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {retryError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1">{retryError}</p>
          <button
            type="button"
            onClick={() => setRetryError(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Tutup pesan"
          >
            ×
          </button>
        </div>
      )}

      {pageError && (
        <div className="space-y-3 rounded-xl border p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 text-destructive" />
            <div className="space-y-1">
              <h2 className="font-semibold">Gagal memuat data</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {pageError}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Coba lagi
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <section
          aria-live="polite"
          className="space-y-4 rounded-xl border bg-card px-6 py-12 text-center sm:px-10"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              Sedang menyusun hasil penilaian
            </h2>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
              AI sedang menganalisis transkrip wawancara. Halaman akan
              diperbarui otomatis setelah proses selesai.
            </p>
          </div>
        </section>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <section className="space-y-4 rounded-xl border border-destructive/30 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 text-destructive" />
            <div className="space-y-1">
              <h2 className="font-semibold">
                Pembuatan portofolio gagal
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Hasil belum tersedia. Coba jalankan proses analisis kembali.
              </p>
            </div>
          </div>

          <Button
            onClick={async () => {
              setRetryError(null);

              try {
                await sessionsApi.regeneratePortfolio(Number(sessionId));
                setGenerating(true);
              } catch {
                setRetryError(
                  "Portofolio belum dapat dibuat ulang. Silakan coba lagi."
                );
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Coba buat ulang
          </Button>
        </section>
      )}

      {/* Ready state */}
      {!generating &&
        !pageError &&
        portfolio?.generation_status === "complete" && (
          <>
            {/* Configured skills */}
            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">
                  Hasil Penilaian Skill
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Level kemampuan, keyakinan AI, dan bukti dari wawancara.
                </p>
              </div>

              {configuredSkills.length > 0 ? (
                <div className="space-y-6">
                  {configuredSkills.map((skill) => (
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
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="font-medium">
                    Belum ada skill yang dinilai
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Hasil penilaian akan muncul di bagian ini jika tersedia.
                  </p>
                </div>
              )}
            </section>

            {/* Discovered skills */}
            {discoveredSkills.length > 0 && (
              <>
                <Separator />

                <section className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                      <Zap className="h-5 w-5 text-amber-600" />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold">
                        Skill Tambahan
                      </h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Kemampuan yang ditemukan AI di luar daftar awal.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {discoveredSkills.map((skill) => (
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

            {/* Fit/Gap */}
            <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <BriefcaseBusiness className="h-5 w-5 text-primary" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-semibold">
                  Bandingkan dengan Lowongan
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Lihat kesesuaian skill kandidat dengan kebutuhan posisi
                  yang dipilih.
                </p>
              </div>

              {vacancies.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Select
                    value={selectedVacancy}
                    onValueChange={setSelectedVacancy}
                  >
                    <SelectTrigger className="min-h-11 w-full sm:flex-1">
                      <SelectValue placeholder="Pilih lowongan..." />
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
                    className="min-h-11"
                    onClick={handleRunFitGap}
                    disabled={!selectedVacancy}
                  >
                    Analisis Fit/Gap
                    <ClipboardCheck className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg bg-muted p-4 text-sm leading-6 text-muted-foreground">
                  Belum ada lowongan yang tersedia. Tambahkan lowongan
                  terlebih dahulu untuk menjalankan analisis.
                </p>
              )}
            </section>
          </>
        )}
    </div>
  );
}
