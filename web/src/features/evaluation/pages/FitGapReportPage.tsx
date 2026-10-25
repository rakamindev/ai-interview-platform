import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "../components/ComparisonTable";
import { usePortfolioQuery } from "../hooks/usePortfolioQuery";
import { useSessionQuery } from "../hooks/useSessionsQuery";
import { useFitGapQuery, useRegenerateFitGapMutation } from "../hooks/useFitGapQuery";
import { useVacancyDetailQuery } from "@/features/vacancies";
import { portfoliosApi } from "../services/portfolios";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, Sparkles, UserCheck, AlertCircle } from "lucide-react";
import type { AssessorOverride } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  // TanStack Query: cached portfolio
  const { data: portfolioData, isLoading: isPortfolioLoading } = usePortfolioQuery(sessionId);
  const portfolio = portfolioData?.portfolio;

  // TanStack Query: cached session metadata
  const { data: session } = useSessionQuery(sessionId);

  // TanStack Query: cached vacancy details
  const { data: vacancy, isError: isVacancyError } = useVacancyDetailQuery(vacancyId);

  // TanStack Query: cached fit/gap report with automatic polling when generating
  const {
    data: fitgapData,
    isLoading: isFitgapLoading,
    isError: isFitgapError,
    error: fitgapError,
    refetch: refetchFitgap,
  } = useFitGapQuery(portfolio?.id, vacancyId);

  // TanStack Query: regenerate mutation with cache invalidation
  const regenerateMutation = useRegenerateFitGapMutation(portfolio?.id, vacancyId);

  const report = fitgapData?.report;
  const hasError = isFitgapError || isVacancyError || regenerateMutation.isError;
  const isGenerating = Boolean(
    !hasError &&
      (fitgapData?.status === "generating" ||
        (portfolio?.id && !report && isFitgapLoading))
  );

  const overrides = useMemo(() => {
    const map: Record<number, AssessorOverride> = {};
    if (portfolio?.overrides) {
      portfolio.overrides.forEach((o) => {
        map[o.portfolio_skill_id] = o;
      });
    }
    if (portfolio?.skills) {
      portfolio.skills.forEach((s) => {
        if (s.assessor_override) {
          map[s.id] = s.assessor_override;
        }
      });
    }
    return map;
  }, [portfolio?.overrides, portfolio?.skills]);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    await regenerateMutation.mutateAsync();
    refetchFitgap();
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob =
        format === "pdf"
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

  const loading = (isPortfolioLoading && !portfolio) || (isFitgapLoading && !report && !isGenerating);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Role Fit & Gap Analysis</h1>
            <Skeleton className="h-4 w-40 mt-1" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  const discoveredSkills = portfolio?.skills?.filter((s) => s.is_discovered) || [];
  const candidateName = session?.candidate_name ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-start gap-3">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="p-2 rounded-lg border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Back to Portfolio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Role Fit & Gap Analysis</h1>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                Evaluation Report
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Candidate: <span className="font-medium text-foreground">{candidateName || `Session #${sessionId}`}</span>
              {vacancy && <span> • Target Role: <strong className="text-foreground">{vacancy.role_title}</strong></span>}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        {portfolio && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending || isGenerating}
              className="shadow-xs"
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5 text-muted-foreground" />
              )}
              Regenerate Analysis
            </Button>
            {report && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                  className="shadow-xs"
                >
                  {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                  className="shadow-xs"
                >
                  {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                  Export JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Generating State */}
      {isGenerating && (
        <div className="border rounded-xl p-12 text-center space-y-4 bg-muted/20">
          <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">Computing Role Fit & Narrative Synthesis</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Calculating competency level deltas, checking human assessor adjustments, and generating executive hiring narratives via Gemini AI.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!isGenerating && hasError && !report && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-destructive/10 text-destructive mb-1">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">Unable to Load Fit/Gap Analysis</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              {(fitgapError as any)?.response?.data?.errors?.[0]?.message ||
                (fitgapError as any)?.response?.data?.message ||
                "The target vacancy could not be accessed or an upstream synthesis error occurred."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchFitgap()}
              className="border-destructive/30 hover:bg-destructive/10"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry Analysis
            </Button>
          </div>
        </div>
      )}

      {/* Not Yet Generated State */}
      {!isGenerating && !hasError && !report && (
        <div className="border rounded-xl p-12 text-center space-y-4 bg-muted/20">
          <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">Ready to Synthesize Role Fit</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Compare this candidate's verified competencies against <strong>{vacancy?.role_title || "the target role"}</strong>.
            </p>
          </div>
          <Button onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
            {regenerateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Fit/Gap Report
          </Button>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-6">
          {/* Skill Comparison Table */}
          <Card className="overflow-hidden border shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Skill-by-Skill Requirement Comparison</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Updated: {new Date(report.generated_at).toLocaleString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* AI Narratives (Culture + Overall) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Culture & Dimension Alignment */}
            <Card className="border shadow-xs bg-card">
              <CardHeader className="p-5 pb-2.5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Culture & Working Style Alignment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.culture_narrative || "Candidate demonstrates strong general communication and ownership traits."}
                </p>
              </CardContent>
            </Card>

            {/* Executive Recommendation */}
            <Card className="border shadow-xs bg-card">
              <CardHeader className="p-5 pb-2.5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Hiring Recommendation Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.overall_narrative || "Candidate evaluation complete against role criteria."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Discovered / Additive Skills */}
          {discoveredSkills.length > 0 && (
            <Card className="border shadow-xs bg-muted/20">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Additive Discovered Competencies ({discoveredSkills.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Skills the candidate exhibited during the interview that are beyond the target role's baseline requirements
                </p>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {discoveredSkills.map((s) => {
                    const override = overrides[s.id];
                    const effectiveLevel = override?.override_level ?? s.ai_level;
                    return (
                      <div key={s.id} className="p-3 bg-background border rounded-lg space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-foreground">{s.skill_label}</span>
                          <div className="flex items-center gap-1.5">
                            {override && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                ✏ Adjusted
                              </span>
                            )}
                            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded">
                              L{effectiveLevel}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {s.competency_summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
