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
import { Check, X, Loader2, RefreshCw, Ban, Eye } from "lucide-react";
import type { CvScreeningEntry } from "@/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared with CvScreeningDetailPage's header row so the column labels always
// line up with these rows — one definition, never two hand-copied strings.
export const CANDIDATE_GRID_COLS = "grid-cols-[44px_1fr_130px_100px_220px_40px]";

function scoreTierClasses(score: number) {
  if (score >= 70) return "bg-[#E4F6EA] text-[#1E9E5A]";
  if (score >= 40) return "bg-[#FDF1DD] text-[#C97A16]";
  return "bg-[#FCE9E9] text-[#D64545]";
}

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
    <div className={`grid ${CANDIDATE_GRID_COLS} items-center gap-3 py-4 px-5 hover:bg-[#FAFBFC]`}>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
        {index}
      </div>

      <div className="space-y-0.5 min-w-0">
        <div className="text-sm font-medium truncate" title={displayFilename}>
          {displayFilename}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {entry.detected_email ?? "No email detected"}
        </div>
        {entry.vacancy_role_title && entry.assessment_name && (
          <div
            className="text-[10px] text-muted-foreground/70 truncate"
            title={`Screened against ${entry.vacancy_role_title} · ${entry.assessment_name}${
              typeof entry.threshold === "number" ? ` · threshold ${entry.threshold}` : ""
            }`}
          >
            {entry.vacancy_role_title} · {entry.assessment_name}
            {typeof entry.threshold === "number" && ` · Threshold ${entry.threshold}`}
          </div>
        )}
      </div>

      <div>
        {isPending && (
          <span className="flex items-center gap-1 text-xs text-[#8A8F98]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8A8F98] shrink-0" />
            Processing
          </span>
        )}
        {isNeedsReview && failedToAnalyze && (
          <span className="flex items-center gap-1 text-xs text-[#D64545]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D64545] shrink-0" />
            Analysis failed
          </span>
        )}
        {isNeedsReview && !failedToAnalyze && (
          <span className="flex items-center gap-1 text-xs text-[#D6941C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D6941C] shrink-0" />
            Needs review
          </span>
        )}
        {isInvited && (
          <span className="flex items-center gap-1 text-xs text-[#1E9E5A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E9E5A] shrink-0" />
            Invited
          </span>
        )}
        {isNotAdvanced && (
          <span className="flex items-center gap-1 text-xs text-[#8A8F98]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8A8F98] shrink-0" />
            Not advanced
          </span>
        )}
      </div>

      <div>
        {typeof entry.score === "number" ? (
          <Badge
            variant="outline"
            className={`min-w-[46px] justify-center border-transparent ${scoreTierClasses(entry.score)}`}
          >
            Score: {entry.score}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex items-center gap-2">
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

        {isNeedsReview && !failedToAnalyze && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs border-[#DADDE3] text-[#17181C] hover:bg-[#F1F2F4]"
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
              className="h-7 px-2 text-xs border-[#F3D3D3] bg-[#FFF6F6] text-[#D64545] hover:bg-[#FCE9E9] hover:text-[#D64545]"
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

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-[#9297A1] hover:bg-[#F1F2F4] hover:text-[#9297A1]"
        title="Preview CV"
        disabled={previewLoading}
        onClick={openPreview}
      >
        {previewLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </Button>

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
