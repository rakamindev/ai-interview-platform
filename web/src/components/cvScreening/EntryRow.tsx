import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cvScreeningsApi } from "@/services/cvScreenings";
import { Check, X, Download, Loader2, RefreshCw, Ban, Eye } from "lucide-react";
import type { CvScreeningEntry } from "@/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EntryRowProps {
  entry: CvScreeningEntry;
  index: number;
  onReview: (entryId: number, action: "invite" | "reject", email?: string) => void;
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

  const [pendingAction, setPendingAction] = useState<"invite" | "reject" | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const emailValid = EMAIL_PATTERN.test(emailInput.trim());
  // Which of Invite/Reject was actually clicked — `reviewing` alone can't tell,
  // since both buttons share one in-flight flag from the parent.
  const [inFlightAction, setInFlightAction] = useState<"invite" | "reject" | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);

  // Opens the tab immediately, synchronously in the click handler, so it's
  // still tied to the user gesture and doesn't get popup-blocked — the fetch
  // is async, so window.open(url) with the final blob URL can't happen until
  // after an await, by which point the click that triggered it has ended.
  // Not try/finally — this app's React Compiler setup bails out around that
  // pattern (see Phase 8/13's frontend docs), so the reset is duplicated in
  // both branches instead, matching handleReview/handleReanalyze/handleCancel.
  const openPreview = async () => {
    const newTab = window.open("", "_blank");
    setPreviewLoading(true);
    try {
      const blob = await cvScreeningsApi.fetchFileBlob(entry.id);
      if (newTab) newTab.location.href = URL.createObjectURL(blob);
      setPreviewLoading(false);
    } catch {
      newTab?.close();
      setPreviewLoading(false);
    }
  };

  const requestReview = (action: "invite" | "reject") => {
    if (!entry.detected_email) {
      setEmailInput("");
      setPendingAction(action);
      return;
    }
    setInFlightAction(action);
    onReview(entry.id, action);
  };

  const confirmReviewWithEmail = () => {
    if (!pendingAction || !emailValid) return;
    setInFlightAction(pendingAction);
    onReview(entry.id, pendingAction, emailInput.trim());
    setPendingAction(null);
  };

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
            title="Preview CV"
            disabled={previewLoading}
            onClick={openPreview}
          >
            {previewLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>

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
                onClick={() => requestReview("invite")}
              >
                {reviewing && inFlightAction === "invite" ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Invite
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={reviewing}
                onClick={() => requestReview("reject")}
              >
                {reviewing && inFlightAction === "reject" ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <X className="h-3 w-3 mr-1" />
                )}
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email required</DialogTitle>
            <DialogDescription>
              No email was detected on this CV. Enter one to {pendingAction} this candidate — it'll
              be used to send the {pendingAction === "invite" ? "invite" : "rejection"} notification.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            placeholder="candidate@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!emailValid || reviewing} onClick={confirmReviewWithEmail}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
