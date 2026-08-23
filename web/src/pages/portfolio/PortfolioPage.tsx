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
  SelectValue
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
  AlertTriangle,
  X
} from "lucide-react";
import { POLL_DEADLINE_MS } from "@/utils/constants";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";
import { m } from "@/paraglide/messages.js";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as unknown as { status?: string; portfolio?: Portfolio };
    if (
      data.status === "generating" ||
      data.portfolio?.generation_status === "generating" ||
      data.portfolio?.generation_status === "pending"
    ) {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      setTimedOut(false);
      // Build overrides map
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  useEffect(() => {
    setError(null);
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        return;
      })
      .catch(() => {
        setError("Failed to load portfolio data. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Stop polling after deadline
  useEffect(() => {
    if (!generating) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      setGenerating(false);
    }, POLL_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [generating]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating && !timedOut);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // PDF: verify the response is actually a PDF (not a JSON error blob)
        const data = res.data;
        if (data instanceof Blob && data.type.includes("application/pdf")) {
          const url = URL.createObjectURL(data);
          const a = document.createElement("a");
          a.href = url;
          a.download = `portfolio-${sessionId}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (data instanceof Blob && data.type.includes("application/json")) {
          // Server returned JSON error inside a Blob response — read it
          const text = await data.text();
          const parsed = JSON.parse(text);
          setExportError(parsed.message ?? parsed.error ?? "Export failed");
        } else {
          setExportError("Export returned an unexpected response. Please try again.");
        }
      }
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to invite"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{m.portfolio.title()}</h1>
            {candidateName && <p className="text-sm text-muted-foreground">{candidateName}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            {m.portfolio.transcript()}
          </Link>
          {!generating && portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                {m.portfolio.export_pdf()}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                {m.portfolio.export_json()}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Export error */}
      {exportError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {exportError}
          <button
            onClick={() => setExportError(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* API error */}
      {error && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            {m.portfolio.retry()}
          </Button>
        </div>
      )}

      {/* Generating state */}
      {!error && generating && !timedOut && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">{m.portfolio.generating()}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {m.portfolio.analyzing()}
            </p>
          </div>
        </div>
      )}

      {/* Timed out state */}
      {!error && timedOut && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {m.portfolio.taking_longer()}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setTimedOut(false);
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {m.portfolio.retry()}
          </Button>
        </div>
      )}

      {/* Failed state */}
      {!generating && !timedOut && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{m.portfolio.generation_failed()}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setTimedOut(false);
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {m.portfolio.retry()}
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && !timedOut && portfolio?.generation_status === "complete" && (
        <>
          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">{m.portfolio.configured_skills()}</h2>
            {portfolio.skills
              .filter((s) => !s.is_discovered)
              .map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
          </div>

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    {m.portfolio.discovered_skills()}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </>
          )}

          <Separator />

          {/* Fit/Gap */}
          <div className="flex items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={m.portfolio.choose_vacancy()} />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
              {m.portfolio.run_fitgap()} →
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
