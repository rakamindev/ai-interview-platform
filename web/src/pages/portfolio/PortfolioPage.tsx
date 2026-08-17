import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import EvidenceReviewCard from "@/components/portfolio/EvidenceReviewCard";
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
  ShieldAlert,
} from "lucide-react";
import type { Portfolio, Vacancy } from "@/types";

type Filter = "all" | "needs_review" | "reviewed" | "discovered";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewsVersion, setReviewsVersion] = useState(0);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

  const handleReviewSaved = useCallback(
    async (skillId: number) => {
      await fetchPortfolio();
      setReviewsVersion((v) => v + 1);
    },
    [fetchPortfolio]
  );

  const skills = useMemo(() => portfolio?.skills ?? [], [portfolio, reviewsVersion]);

  const configuredSkills = skills.filter((s) => !s.is_discovered);
  const discoveredSkills = skills.filter((s) => s.is_discovered);
  const needsReview = skills.filter((s) => s.requires_review && !s.review);
  // A skill counts as reviewed when it has a disposition OR never needed one.
  const reviewed = skills.filter((s) => !!s.review || !s.requires_review);

  const visibleSkills = useMemo(() => {
    switch (filter) {
      case "needs_review":
        return skills.filter((s) => s.requires_review && !s.review);
      case "reviewed":
        return skills.filter((s) => !!s.review);
      case "discovered":
        return discoveredSkills;
      default:
        return skills;
    }
  }, [filter, skills, discoveredSkills]);

  const reviewProgress =
    skills.length === 0 ? 0 : Math.round((reviewed.length / skills.length) * 100);

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    // Gate: vacancy-relevant (configured) skills needing review must have a disposition.
    const unresolved = needsReview.filter((s) => !s.is_discovered);
    if (unresolved.length > 0) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const fitGapBlocked = needsReview.filter((s) => !s.is_discovered).length > 0;

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
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
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Evidence Review</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio && (
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
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-destructive">Portfolio generation failed.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Review workspace */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Review progress */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Review progress</span>
              <span className="text-muted-foreground">
                {reviewed.length}/{skills.length} reviewed
                {needsReview.length > 0 && (
                  <span className="text-amber-600 ml-1.5">· {needsReview.length} need review</span>
                )}
              </span>
            </div>
            <Progress value={reviewProgress} className="h-2" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={filter === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("all")}
            >
              All ({skills.length})
            </Badge>
            <Badge
              variant={filter === "needs_review" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("needs_review")}
            >
              Needs review ({needsReview.length})
            </Badge>
            <Badge
              variant={filter === "reviewed" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("reviewed")}
            >
              Reviewed ({reviewed.length})
            </Badge>
            <Badge
              variant={filter === "discovered" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("discovered")}
            >
              Discovered ({discoveredSkills.length})
            </Badge>
          </div>

          {/* Skill cards */}
          <div className="space-y-3">
            {visibleSkills.length === 0 && (
              <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
                {filter === "needs_review"
                  ? "No skills need review — all evaluations have a disposition."
                  : filter === "reviewed"
                    ? "No reviewed skills yet."
                    : "No skills in this view."}
              </div>
            )}
            {visibleSkills.map((skill) => (
              <EvidenceReviewCard
                key={skill.id}
                skill={skill}
                onReviewSaved={handleReviewSaved}
                onEvidenceClick={(turnNumber) =>
                  navigate(`/assessments/${id}/sessions/${sessionId}/transcript?turn=${turnNumber}`)
                }
              />
            ))}
          </div>

          <Separator />

          {/* Fit/Gap with gating */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choose vacancy..." />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleRunFitGap} disabled={!selectedVacancy || fitGapBlocked}>
                Run Fit/Gap Analysis →
              </Button>
            </div>

            {fitGapBlocked && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{needsReview.filter((s) => !s.is_discovered).length} skill(s)</strong> relevant to
                  this vacancy still need a human review. Resolve them before running fit/gap so the
                  comparison uses reviewed evidence, not unverified AI output.
                </span>
              </div>
            )}

            {discoveredSkills.some((s) => s.requires_review) && (
              <p className="text-xs text-muted-foreground">
                Discovered skills (not vacancy requirements) may be unreviewed — they warn but do not block fit/gap.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
