import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import { useFitGapReportPage } from "./useFitGapReportPage";

export default function FitGapReportPage() {
  const {
    id,
    sessionId,
    report,
    portfolio,
    generating,
    loading,
    exporting,
    regenerating,
    handleRegenerate,
    handleExport,
    fetchError,
    exportError,
    refetchData,
  } = useFitGapReportPage();

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {fetchError ? (
        <div className="flex flex-col items-center justify-center pt-3 pb-6 min-h-[40vh] text-center">
          <p className="mt-1 text-sm text-destructive">{fetchError}</p>
          <Button className="mt-3" variant="destructiveOutline" onClick={refetchData}>
            Try Again
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link
                  to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
              </div>
            </div>

            {portfolio && (
              <div className="flex gap-2 grow justify-end pt-3 xs:pt-0">
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
            )}
          </div>

          {/* Export Error */}
          {exportError && (
            <div className="bg-destructive/15 p-3 rounded-md text-sm text-destructive">
              <p>{exportError}</p>
            </div>
          )}

          {/* Generating */}
          {generating && (
            <div className="border rounded-lg p-12 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
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

              {/* Culture & competency */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {report.culture_narrative || report.overall_narrative}
                  </p>
                </CardContent>
              </Card>

              {/* Discovered skills */}
              {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
                <>
                  <Separator />
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Discovered Skills (not in vacancy requirements)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      {portfolio.skills
                        .filter((s) => s.is_discovered)
                        .map((s) => (
                          <div key={s.id} className="text-sm flex items-center gap-2">
                            <span className="font-medium">{s.skill_label}</span>
                            <span className="text-muted-foreground">
                              {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                            </span>
                            <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
