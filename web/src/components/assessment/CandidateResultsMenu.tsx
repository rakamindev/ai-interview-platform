import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardCheck, FileDown, FileText, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";

interface CandidateResultsMenuProps {
  assessmentId: string;
  sessionId: number;
  candidateName: string;
}

// Split button for a finished interview: the main next step (review the
// portfolio) is one click, and the menu shows everything else available.
export default function CandidateResultsMenu({ assessmentId, sessionId, candidateName }: CandidateResultsMenuProps) {
  const navigate = useNavigate();
  const [exportFailed, setExportFailed] = useState(false);
  const base = `/assessments/${assessmentId}/sessions/${sessionId}`;

  const exportPdf = async () => {
    setExportFailed(false);
    try {
      const res = await sessionsApi.getPortfolio(sessionId);
      if (!("portfolio" in res.data) || !res.data.portfolio) throw new Error("portfolio not ready");
      const pdf = await portfoliosApi.exportPortfolio(res.data.portfolio.id, "pdf");
      const url = URL.createObjectURL(new Blob([pdf.data as BlobPart], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio-${sessionId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportFailed(true);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center">
        <Button variant="outline" size="sm" className="h-7 rounded-r-none px-2 text-xs"
                aria-label={`Review results for ${candidateName}`} onClick={() => navigate(`${base}/portfolio`)}>
          <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
          Review results
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 rounded-l-none border-l-0 px-1.5 max-sm:min-w-11"
                    aria-label={`More results for ${candidateName}`}>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate(`${base}/portfolio`)}>
              <ClipboardCheck aria-hidden="true" className="mr-2 h-4 w-4" />Portfolio and review
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`${base}/portfolio#fit-gap`)}>
              <GitCompareArrows aria-hidden="true" className="mr-2 h-4 w-4" />Fit/Gap report
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`${base}/transcript`)}>
              <FileText aria-hidden="true" className="mr-2 h-4 w-4" />Transcript
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={exportPdf}>
              <FileDown aria-hidden="true" className="mr-2 h-4 w-4" />Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {exportFailed && (
        <p role="alert" className="text-xs text-red-700">The PDF could not be created. Open the results and try again.</p>
      )}
    </div>
  );
}
