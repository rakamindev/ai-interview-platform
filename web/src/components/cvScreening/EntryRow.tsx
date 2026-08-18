import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cvScreeningsApi } from "@/services/cvScreenings";
import { Check, X, Download, Loader2, RefreshCw, Ban } from "lucide-react";
import type { CvScreeningEntry } from "@/types";

interface EntryRowProps {
  entry: CvScreeningEntry;
  index: number;
  onReview: (entryId: number, action: "invite" | "reject") => void;
  reviewing: boolean;
  onReanalyze: (entryId: number) => void;
  reanalyzing: boolean;
  onCancel: (entryId: number) => void;
  cancelling: boolean;
}

export default function EntryRow({
  entry,
  index,
  onReview,
  reviewing,
  onReanalyze,
  reanalyzing,
  onCancel,
  cancelling,
}: EntryRowProps) {
  const isPending = entry.decision === "pending";
  const isNeedsReview = entry.decision === "needs_review";
  const isInvited = entry.decision === "invited";
  const isNotAdvanced = entry.decision === "not_advanced";
  const failedToAnalyze =
    entry.decision_reason === "model_failed" || entry.decision_reason === "cancelled";
  const displayFilename = entry.filename ?? "—";

  return (
    <div className="flex items-center justify-between py-3 px-4 gap-3 flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
          {index}
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-medium truncate max-w-[220px]" title={displayFilename}>
            {displayFilename}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
            {entry.detected_email ?? "No email detected"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {typeof entry.score === "number" && (
          <Badge variant="secondary">Score: {entry.score}</Badge>
        )}

        {isPending && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </span>
        )}
        {isNeedsReview && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Needs review
          </span>
        )}
        {isInvited && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Invited
          </span>
        )}
        {isNotAdvanced && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            Not advanced
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            title="Download original file"
            onClick={() => cvScreeningsApi.downloadFile(entry.id, entry.filename ?? undefined)}
          >
            <Download className="h-3 w-3" />
          </Button>

          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              disabled={cancelling}
              title="Stop waiting for analysis and move this to Needs review"
              onClick={() => onCancel(entry.id)}
            >
              <Ban className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}

          {isNeedsReview && failedToAnalyze && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={reanalyzing}
              title="The automated analysis failed (e.g. a transient Gemini error) — try it again"
              onClick={() => onReanalyze(entry.id)}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${reanalyzing ? "animate-spin" : ""}`} />
              Re-analyze
            </Button>
          )}

          {isNeedsReview && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={reviewing}
                onClick={() => onReview(entry.id, "invite")}
              >
                <Check className="h-3 w-3 mr-1" /> Invite
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={reviewing}
                onClick={() => onReview(entry.id, "reject")}
              >
                <X className="h-3 w-3 mr-1" /> Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
