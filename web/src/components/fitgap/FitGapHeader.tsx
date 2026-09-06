import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";

interface FitGapHeaderProps {
  assessmentId: string;
  sessionId: string;
  vacancyTitle?: string;
  candidateName?: string | null;
  hasPortfolio: boolean;
  hasReport: boolean;
  generating: boolean;
  regenerating: boolean;
  exporting: "pdf" | "json" | null;
  onRegenerate: () => void;
  onExport: (format: "pdf" | "json") => void;
}

export default function FitGapHeader({
  assessmentId,
  sessionId,
  vacancyTitle,
  candidateName,
  hasPortfolio,
  hasReport,
  generating,
  regenerating,
  exporting,
  onRegenerate,
  onExport,
}: FitGapHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <Link
          to={`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`}
          className="text-muted-foreground hover:text-foreground"
          title="Back to Portfolio"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Fit / Gap Analysis</h1>
            {vacancyTitle && (
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {vacancyTitle}
              </span>
            )}
          </div>
          {candidateName && (
            <p className="text-sm text-muted-foreground">{candidateName}</p>
          )}
        </div>
      </div>

      {hasPortfolio && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating || generating}
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Re-analyze
          </Button>
          {hasReport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "JSON"
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
