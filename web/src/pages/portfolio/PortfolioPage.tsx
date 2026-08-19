import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import IntegritySummary from "@/components/portfolio/IntegritySummary";
import ErrorNote from "@/components/ErrorNote";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, FileText } from "lucide-react";
import type { Portfolio, PortfolioIntegrity, AssessmentState, Vacancy } from "@/types";

const GROUPS: { key: AssessmentState; label: string; description: string }[] = [
  { key: "assessed", label: "Assessed", description: "Probed with evidence" },
  { key: "partially_assessed", label: "Partially assessed", description: "Lightly probed or low confidence" },
  { key: "not_assessed", label: "Not assessed", description: "Not covered in this interview — shown for transparency, not scored" },
  { key: "discovered", label: "Discovered", description: "Surfaced during the interview, not in the original plan" },
];

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [integrity, setIntegrity] = useState<PortfolioIntegrity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as {
      status?: string;
      portfolio?: Portfolio;
      integrity?: PortfolioIntegrity;
    };
    const status = data.status ?? data.portfolio?.generation_status;
    if (status === "generating" || status === "pending") {
      setGenerating(true);
      return;
    }
    if (data.portfolio) {
      setPortfolio(data.portfolio);
      setIntegrity(data.integrity ?? null);
      setGenerating(false);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError("Failed to load the portfolio. Please refresh to try again."))
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  usePolling(fetchPortfolio, 5000, generating);

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      const blob =
        format === "json"
          ? new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
          : new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const complete = !generating && portfolio?.generation_status === "complete";
  const skills = integrity?.skills ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error && <ErrorNote message={error} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && <p className="text-sm text-muted-foreground">{candidateName}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {complete && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating */}
      {generating && (
        <div className="space-y-3 rounded-lg border p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="font-medium">Generating portfolio…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Failed */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="space-y-3 rounded-lg border border-destructive/40 p-6 text-center">
          <p className="text-sm text-destructive">Portfolio generation failed.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await sessionsApi.regeneratePortfolio(Number(sessionId));
                setGenerating(true);
              } catch {
                setError("Could not restart generation. Please try again.");
              }
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Complete */}
      {complete && integrity && (
        <>
          <IntegritySummary summary={integrity.summary} />

          {skills.length === 0 && (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              This interview produced no skills to display.
            </div>
          )}

          {GROUPS.map((group) => {
            const groupSkills = skills.filter((s) => s.state === group.key);
            if (groupSkills.length === 0) return null;
            return (
              <div key={group.key} className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">{group.label} <span className="font-normal text-muted-foreground">({groupSkills.length})</span></h2>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                {groupSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.portfolio_skill_id ?? `${skill.state}-${skill.skill_label}`}
                    skill={skill}
                    onOverrideSaved={fetchPortfolio}
                  />
                ))}
              </div>
            );
          })}

          <Separator />

          {/* Fit/Gap */}
          <div className="flex items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose vacancy…" />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.role_title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
