import { ArrowLeft, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import type { FitGapExportFormat } from "../types/fit-gap.types";

interface FitGapReportHeaderProps {
  backToPortfolioUrl: string;
  canRegenerate: boolean;
  candidateName: string | null;
  exportingFormat: FitGapExportFormat | null;
  isGenerating: boolean;
  isReady: boolean;
  isRegenerating: boolean;
  onExport: (format: FitGapExportFormat) => void;
  onRegenerate: () => void;
  roleTitle: string;
}

export function FitGapReportHeader({
  backToPortfolioUrl,
  canRegenerate,
  candidateName,
  exportingFormat,
  isGenerating,
  isReady,
  isRegenerating,
  onExport,
  onRegenerate,
  roleTitle,
}: FitGapReportHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Link
          to={backToPortfolioUrl}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to portfolio
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Evidence review
        </div>
        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {roleTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {candidateName ? `${candidateName} · ` : ""}
          AI-assisted comparison for assessor review
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={!canRegenerate || isRegenerating || isGenerating}
        >
          {isRegenerating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          )}
          Re-run
        </Button>
        {isReady
          ? (["pdf", "json"] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                size="sm"
                onClick={() => onExport(format)}
                disabled={exportingFormat !== null}
              >
                {exportingFormat === format ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                )}
                {format.toUpperCase()}
              </Button>
            ))
          : null}
      </div>
    </header>
  );
}
