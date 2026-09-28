import { notify } from "@/components/ui/toast";
import { useBreadcrumbLabel } from "@/components/layout/Breadcrumbs";
import { ErrorState, EmptyState } from "@/components/ui/page";
import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import NarrativeCards from "@/components/fitgap/NarrativeCards";
import { portfoliosApi } from "@/services/portfolios";
import { vacanciesApi } from "@/services/vacancies";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, HiringDecision, Portfolio } from "@/types";

const DECISION_OPTIONS: Array<{
  value: HiringDecision;
  label: string;
  description: string;
}> = [
  {
    value: "advance",
    label: "Advance",
    description: "Move the candidate to the next stage",
  },
  {
    value: "hold",
    label: "Hold",
    description: "Keep under consideration pending more evidence",
  },
  {
    value: "reject",
    label: "Reject",
    description: "Do not proceed with this application",
  },
];

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  useBreadcrumbLabel(`assessments:${id}`, assessmentName);
  useBreadcrumbLabel(`sessions:${sessionId}`, candidateName);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [decision, setDecision] = useState<HiringDecision | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decidedAt, setDecidedAt] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(
        portfolio.id,
        Number(vacancyId),
      );
      setReport(res.data.report);
      setLoadError(null);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setLoadError(null);
        } catch {
          setLoadError("Could not start report generation. Please try again.");
          setGenerating(false);
        }
      } else {
        setLoadError("Could not load the fit/gap report. Please try again.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    let active = true;
    vacanciesApi
      .get(Number(vacancyId))
      .then((res) => {
        if (active) setVacancyTitle(res.data.vacancy.role_title);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vacancyId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([portfolioRes, sessionRes]) => {
        const data = portfolioRes.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
        setAssessmentName(sessionRes.data.assessment?.name ?? "");
        const session = sessionRes.data.session;
        setCandidateName(session.candidate_name || "Candidate " + session.id);
        setDecision(session.hiring_decision ?? null);
        setDecisionNotes(session.decision_notes ?? "");
        setDecidedAt(session.decided_at ?? null);
      })
      .catch(() =>
        setLoadError(
          "Could not load the candidate evaluation. Please try again.",
        ),
      )
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
      notify("Report regeneration started.");
      setReport(null);
      setGenerating(true);
    } catch {
      notify("Could not regenerate the report. Please try again.", "error");
      setLoadError("Could not regenerate the report. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId),
      );
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      notify(`${format.toUpperCase()} download started.`);
    } catch {
      notify("Could not export the report. Please try again.", "error");
      setExportError(
        `Failed to export ${format.toUpperCase()}. Please try again.`,
      );
    } finally {
      setExporting(null);
    }
  };

  const handleSaveDecision = async () => {
    if (!decision || !decisionNotes.trim()) {
      setDecisionError("Choose a decision and add a short rationale.");
      return;
    }

    setSavingDecision(true);
    setDecisionError(null);
    setDecisionSaved(false);
    try {
      const res = await sessionsApi.updateDecision(
        Number(sessionId),
        decision,
        decisionNotes.trim(),
      );
      setDecisionNotes(res.data.session.decision_notes ?? decisionNotes.trim());
      setDecidedAt(res.data.session.decided_at ?? null);
      setDecisionSaved(true);
      notify("Hiring decision saved.");
    } catch (e: any) {
      notify("Could not save the hiring decision. Please try again.", "error");
      setDecisionError(
        e?.response?.data?.errors?.[0]?.message ??
          "Failed to save the hiring decision.",
      );
    } finally {
      setSavingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="detail-page">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              aria-label="Back to previous page"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-semibold sm:text-[28px] tracking-tight">
              Fit/Gap Report
            </h1>
          </div>
          <p className="pl-6 text-sm text-muted-foreground">
            {candidateName}
            {vacancyTitle && " · " + vacancyTitle}
          </p>
        </div>

        {portfolio && (
          <div className="grid w-full grid-flow-col auto-cols-fr gap-2 sm:flex sm:w-auto">
            <Button
              className="w-full px-2 sm:w-auto sm:px-3"
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5 shrink-0" />
              )}
              Regenerate
            </Button>
            {report && (
              <>
                <Button
                  className="w-full px-2 sm:w-auto sm:px-3"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5 shrink-0" />
                  )}
                  PDF
                </Button>
                <Button
                  className="w-full px-2 sm:w-auto sm:px-3"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5 shrink-0" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {loadError && (
        <ErrorState
          message={loadError}
          onRetry={() =>
            portfolio ? void fetchReport() : window.location.reload()
          }
        />
      )}
      {!loadError && !portfolio && (
        <EmptyState
          title="Evaluation not available yet"
          description="Wait for the candidate portfolio to finish, then open this report again."
          action={
            <Button asChild variant="outline">
              <Link
                to={
                  "/assessments/" + id + "/sessions/" + sessionId + "/portfolio"
                }
              >
                View portfolio
              </Link>
            </Button>
          }
        />
      )}
      {exportError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {exportError}
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Generating fit/gap report...
          </p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          <NarrativeCards
            culture_narrative={report.culture_narrative}
            overall_narrative={report.overall_narrative}
            narrative_source={report.narrative_source}
          />

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-warning" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="text-sm flex items-center gap-2"
                      >
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} (
                          {s.ai_confidence?.toLowerCase() === "low"
                            ? "low confidence"
                            : "confirmed"}
                          )
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — Not required for this role, may be additive.
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}

          <Separator />

          {/* Human-owned decision */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Hiring Decision</CardTitle>
              <p className="text-xs text-muted-foreground">
                AI output is supporting evidence. The final decision is yours
                and requires a rationale.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {DECISION_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={decision === option.value ? "default" : "outline"}
                    className="h-auto min-h-16 flex-col items-start whitespace-normal px-3 py-2 text-left"
                    aria-pressed={decision === option.value}
                    onClick={() => {
                      setDecision(option.value);
                      setDecisionSaved(false);
                    }}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span
                      className={
                        decision === option.value
                          ? "text-xs text-primary-foreground/80"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {option.description}
                    </span>
                  </Button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="decision-rationale">Decision rationale</Label>
                <Textarea
                  id="decision-rationale"
                  value={decisionNotes}
                  onChange={(event) => {
                    setDecisionNotes(event.target.value);
                    setDecisionSaved(false);
                  }}
                  placeholder="Summarize the evidence and trade-offs behind this decision..."
                  rows={4}
                />
              </div>

              {decisionSaved && (
                <p role="status" className="text-sm text-success">
                  Hiring decision saved.
                </p>
              )}
              {decisionError && (
                <p role="alert" className="text-sm text-destructive">
                  {decisionError}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {decidedAt
                    ? `Last saved ${new Date(decidedAt).toLocaleString()}`
                    : "No hiring decision has been recorded yet."}
                </p>
                <Button
                  onClick={handleSaveDecision}
                  disabled={savingDecision || !decision}
                >
                  {savingDecision && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  {decidedAt ? "Update Decision" : "Save Decision"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
