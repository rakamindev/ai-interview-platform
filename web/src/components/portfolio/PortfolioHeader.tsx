import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";

interface PortfolioHeaderProps {
  assessmentId: string;
  sessionId: string;
  candidateName: string | null;
  generating: boolean;
  hasPortfolio: boolean;
  exporting: "pdf" | "json" | null;
  onExport: (format: "pdf" | "json") => void;
}

export default function PortfolioHeader({
  assessmentId,
  sessionId,
  candidateName,
  generating,
  hasPortfolio,
  exporting,
  onExport,
}: PortfolioHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2.5">
        <Link
          to={`/assessments/${assessmentId}/invite`}
          className="text-muted-foreground hover:text-foreground"
          title="Back to Sessions"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Competency Portfolio</h1>
          {candidateName && (
            <p className="text-sm text-muted-foreground">{candidateName}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={`/assessments/${assessmentId}/sessions/${sessionId}/transcript`}
          className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Transcript
        </Link>
        {!generating && hasPortfolio && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("pdf")}
              disabled={!!exporting}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1" />
              )}
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("json")}
              disabled={!!exporting}
            >
              {exporting === "json" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                "JSON"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
