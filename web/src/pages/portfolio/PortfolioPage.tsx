import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { usePolling } from "@/hooks/usePolling";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { AssessorOverride, Portfolio, Vacancy } from "@/types";

interface ApiErrorShape {
  response?: {
    data?: {
      error?: string;
      message?: string;
      errors?: Array<{ message?: string }>;
    };
  };
}

function errorMessage(error: unknown, fallback: string) {
  const response = (error as ApiErrorShape).response?.data;
  return response?.error ?? response?.message ?? response?.errors?.[0]?.message ?? fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </div>
  );
}

function StatePanel({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "neutral" | "warning" | "danger";
}) {
  const styles = {
    neutral: "border-slate-200 bg-white",
    warning: "border-amber-200 bg-amber-50/70",
    danger: "border-rose-200 bg-rose-50/70",
  };

  return (
    <Card className={styles[tone]}>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        {icon}
        <div className="max-w-lg space-y-1">
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const numericSessionId = Number(sessionId);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const response = await sessionsApi.getPortfolio(numericSessionId);
      const data = response.data as { portfolio?: Portfolio; status?: string };
      const nextPortfolio = data.portfolio ?? null;
      setPortfolio(nextPortfolio);
      if (nextPortfolio) {
        const nextOverrides: Record<number, AssessorOverride> = {};
        for (const override of nextPortfolio.overrides ?? []) {
          nextOverrides[override.portfolio_skill_id] = override;
        }
        setOverrides(nextOverrides);
      }
      setGenerating(
        data.status === "pending" ||
          data.status === "generating" ||
          nextPortfolio?.generation_status === "pending" ||
          nextPortfolio?.generation_status === "generating",
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Portfolio belum dapat dimuat. Coba lagi."));
    }
  }, [numericSessionId]);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setLoadError(null);
      try {
        const [, vacancyResponse, sessionResponse] = await Promise.all([
          fetchPortfolio(),
          vacanciesApi.list(),
          sessionsApi.get(numericSessionId),
        ]);
        if (active) {
          setVacancies(vacancyResponse.data.vacancies);
          setCandidateName(sessionResponse.data.session.candidate_name ?? null);
        }
      } catch (error) {
        if (active) setLoadError(errorMessage(error, "Data halaman belum dapat dimuat."));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
  }, [fetchPortfolio, numericSessionId]);

  usePolling(fetchPortfolio, 5000, generating);

  const configuredSkills = useMemo(
    () => portfolio?.skills.filter((skill) => !skill.is_discovered) ?? [],
    [portfolio],
  );
  const discoveredSkills = useMemo(
    () => portfolio?.skills.filter((skill) => skill.is_discovered) ?? [],
    [portfolio],
  );
  const notAssessedCount = configuredSkills.filter(
    (skill) => skill.rating_status === "not_assessed" && !overrides[skill.id],
  ).length;
  const lowConfidenceCount = portfolio?.skills.filter(
    (skill) => skill.ai_confidence?.toLowerCase() === "low" && skill.rating_status !== "not_assessed",
  ).length ?? 0;
  const ratedCount = (portfolio?.skills.length ?? 0) - notAssessedCount;

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((previous) => ({ ...previous, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleRetry = async () => {
    setRetrying(true);
    setLoadError(null);
    try {
      await sessionsApi.regeneratePortfolio(numericSessionId);
      setGenerating(true);
      await fetchPortfolio();
    } catch (error) {
      setLoadError(errorMessage(error, "Portfolio belum dapat dijalankan ulang."));
    } finally {
      setRetrying(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setLoadError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined,
      );
      if (format === "json") {
        downloadBlob(
          new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" }),
          `portfolio-${sessionId}.json`,
        );
      } else {
        downloadBlob(new Blob([response.data as BlobPart], { type: "application/pdf" }), `portfolio-${sessionId}.pdf`);
      }
    } catch (error) {
      setLoadError(errorMessage(error, "Export gagal dibuat."));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              to={`/assessments/${id}/invite`}
              aria-label="Back to assessment"
              className="mt-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Assessor workspace
              </div>
              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950">Portfolio results</h1>
              <p className="mt-1 text-sm text-slate-500">{candidateName ?? "Candidate"} · evidence-led interview signal</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Transcript
            </Link>
            {portfolio?.generation_status === "complete" && (
              <>
                <Button variant="outline" size="sm" onClick={() => void handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        </header>

        {loadError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        )}

        {generating && (
          <StatePanel
            icon={<Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden="true" />}
            title="Generating portfolio"
            description="AI sedang merangkum transcript menjadi skill, level, confidence, dan evidence. Halaman ini akan memperbarui status secara berkala."
            tone="neutral"
          />
        )}

        {!generating && portfolio?.generation_status === "failed" && (
          <StatePanel
            icon={<ShieldAlert className="h-9 w-9 text-rose-600" aria-hidden="true" />}
            title="Portfolio generation failed"
            description={portfolio.generation_error || "Generation berhenti sebelum portfolio lengkap tersimpan."}
            tone="danger"
            action={
              <Button onClick={() => void handleRetry()} disabled={retrying}>
                {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Retry generation
              </Button>
            }
          />
        )}

        {!generating && !portfolio && !loadError && (
          <StatePanel
            icon={<AlertCircle className="h-9 w-9 text-amber-600" aria-hidden="true" />}
            title="Portfolio belum tersedia"
            description="Belum ada hasil yang dapat ditampilkan untuk session ini. Jalankan ulang generation setelah transcript selesai."
            tone="warning"
            action={<Button onClick={() => void handleRetry()} disabled={retrying}>Retry</Button>}
          />
        )}

        {!generating && portfolio?.generation_status === "complete" && (
          <>
            <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Rated signals" value={ratedCount} tone="text-indigo-700" />
              <Metric label="Needs evidence" value={notAssessedCount} tone="text-amber-700" />
              <Metric label="Low confidence" value={lowConfidenceCount} tone="text-rose-700" />
              <Metric label="Discovered" value={discoveredSkills.length} tone="text-emerald-700" />
            </section>

            <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
              <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-950">Portfolio is ready for review</p>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                      Review evidence before treating a level as decision-grade. Skill tanpa rating tidak akan dipaksa menjadi gap atau match.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {configuredSkills.length > 0 ? (
              <section className="space-y-3" aria-labelledby="configured-skills-heading">
                <div>
                  <h2 id="configured-skills-heading" className="text-lg font-bold text-slate-950">Configured skills</h2>
                  <p className="mt-1 text-sm text-slate-500">Skills yang didefinisikan assessment dan punya expected behavior.</p>
                </div>
                {configuredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(override) => handleOverrideSaved(skill.id, override)}
                  />
                ))}
              </section>
            ) : (
              <StatePanel
                icon={<AlertCircle className="h-8 w-8 text-amber-600" aria-hidden="true" />}
                title="No configured skills"
                description="Assessment ini tidak memiliki skill terkonfigurasi. Discovered skills tetap dapat ditinjau di bawah."
                tone="warning"
              />
            )}

            {discoveredSkills.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3" aria-labelledby="discovered-skills-heading">
                  <div>
                    <h2 id="discovered-skills-heading" className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />
                      Discovered skills
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">Signal tambahan yang muncul dari interview, di luar daftar awal assessment.</p>
                  </div>
                  {discoveredSkills.map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(override) => handleOverrideSaved(skill.id, override)}
                    />
                  ))}
                </section>
              </>
            )}

            <Separator />

            <Card className="border-slate-200 bg-slate-950 text-white">
              <CardHeader>
                <CardTitle className="text-lg">Compare against a vacancy</CardTitle>
                <p className="text-sm leading-relaxed text-slate-300">Pilih role untuk melihat required level, match, gap, dan evidence state.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="border-slate-700 bg-slate-900 text-white sm:max-w-xs">
                    <SelectValue placeholder="Choose vacancy" />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((vacancy) => (
                      <SelectItem key={vacancy.id} value={String(vacancy.id)}>
                        {vacancy.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleRunFitGap} disabled={!selectedVacancy} className="bg-indigo-500 text-white hover:bg-indigo-400">
                  Run Fit/Gap analysis
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
