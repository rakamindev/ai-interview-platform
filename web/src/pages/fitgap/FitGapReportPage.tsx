import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { Download, Loader2, RefreshCw, Zap, ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { LEVEL_LABELS } from "@/utils/constants";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();
  const navigate = useNavigate();

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
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setError("No portfolio found for this session. The interview may not have been completed.");
        }
      })
      .catch(() => {
        setError("Failed to load portfolio.");
      })
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
      setReport(null);
      setGenerating(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
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
    } finally {
      setExporting(null);
    }
  };

  const matchCount = report?.skill_comparisons.filter((c) => c.result === "match").length ?? 0;
  const gapCount = report?.skill_comparisons.filter((c) => c.result === "gap").length ?? 0;
  const exceedCount = report?.skill_comparisons.filter((c) => c.result === "exceed").length ?? 0;
  const totalSkills = report?.skill_comparisons.length ?? 1;
  const fitScore = Math.round(((matchCount + exceedCount) / totalSkills) * 100);

  const getVerdictColor = (score: number) => {
    if (score >= 70) return { bg: "bg-teal-500", text: "text-teal-700", badge: "bg-teal-50 text-teal-700 border-teal-200" };
    if (score >= 40) return { bg: "bg-amber-400", text: "text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200" };
    return { bg: "bg-red-500", text: "text-red-700", badge: "bg-red-50 text-red-700 border-red-200" };
  };

  if (loading) {
    return (
      <div className="max-w-[1040px] mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1040px] mx-auto space-y-4">
        <Breadcrumb items={[{ label: "Sessions", href: `/assessments/${id}/invite` }]} />
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-500">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/assessments/${id}/invite`)}>
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1040px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Breadcrumb items={[
            { label: "Sessions", href: `/assessments/${id}/invite` },
            { label: "Fit/Gap Report" }
          ]} />
          <h1 className="text-xl font-semibold mt-1">Fit/Gap Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comparing portfolio against role requirements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Regenerate
          </Button>
          {report && (
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

      {/* Generating */}
      {generating && (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="font-semibold text-gray-900">Generating fit/gap report...</p>
          <p className="text-sm text-gray-500 mt-1">Comparing the candidate's portfolio against the role requirements.</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
          {/* Main content */}
          <div className="space-y-5">
            {/* Skill comparison */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Skill Comparison</h2>
              </div>
              <div className="px-5 py-4">
                <ComparisonTable comparisons={report.skill_comparisons} />
              </div>
            </div>

            {/* Culture & competency */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Culture &amp; Competency Fit</h2>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {report.culture_narrative || report.overall_narrative}
                </p>
              </div>
            </div>

            {/* Discovered skills */}
            {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center gap-2">
                        <span className="font-medium text-gray-900">{s.skill_label}</span>
                        <span className="text-xs text-gray-500 font-medium">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-gray-400">— Not required for this role, may be additive.</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Verdict card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
              <div className="relative w-[90px] h-[90px] mx-auto mb-3">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r="38" fill="none" stroke="#E9ECEF" strokeWidth="7" />
                  <circle
                    cx="45" cy="45" r="38" fill="none"
                    stroke={fitScore >= 70 ? "#1D9E75" : fitScore >= 40 ? "#EF9F27" : "#E24B4A"}
                    strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 - (fitScore / 100) * 2 * Math.PI * 38}
                    strokeLinecap="round"
                  />
                </svg>
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center text-2xl font-bold",
                  fitScore >= 70 ? "text-teal-700" : fitScore >= 40 ? "text-amber-700" : "text-red-700"
                )}>
                  {fitScore}%
                </div>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Verdict</p>
              <p className={cn("text-sm font-semibold", getVerdictColor(fitScore).text)}>
                {fitScore >= 70 ? "Good fit" : fitScore >= 40 ? "Partial fit" : "Significant gaps detected"}
              </p>

              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-4 mb-4">
                <div
                  className={cn("h-full rounded-full", getVerdictColor(fitScore).bg)}
                  style={{ width: `${fitScore}%` }}
                />
              </div>

              <div className="space-y-0">
                {[
                  ["Skills matched", `${matchCount}/${totalSkills}`],
                  ["Skills with gaps", `${gapCount}/${totalSkills}`],
                  ["Skills exceeding", `${exceedCount}/${totalSkills}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-b-0 text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-900 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-gray-900 mb-2">Recommendation</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {fitScore >= 70
                  ? "This candidate meets most role requirements. Consider advancing to the next interview round."
                  : fitScore >= 40
                  ? "This candidate shows partial fit. Some skills need further validation. Consider targeted follow-up."
                  : "This candidate has significant gaps in core skills. Consider whether the gaps are trainable or if the role is a mismatch."}
              </p>
            </div>

            {/* Back to portfolio CTA */}
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50 transition-colors w-full justify-center"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to portfolio
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
