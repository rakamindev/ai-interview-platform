import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { extractErrorMessage } from "@/lib/utils";
import { Loader2, Trash2 } from "lucide-react";
import type { DeletionCheckResult } from "@/types";

type Phase = "closed" | "checking" | "blocked" | "confirm" | "deleting";

interface DeleteResourceDialogProps {
  /** Lowercase, used inline in copy — e.g. "vacancy", "assessment", "CV screening". */
  resourceLabel: string;
  /** Exact text the recruiter must type to enable the delete button. */
  resourceName: string;
  /**
   * Omit for a resource with no blocking case (CV screening) — skips
   * straight to the confirm step instead of checking first.
   */
  checkEligibility?: () => Promise<DeletionCheckResult>;
  onConfirmDelete: () => Promise<void>;
  onDeleted: () => void;
}

export default function DeleteResourceDialog({
  resourceLabel,
  resourceName,
  checkEligibility,
  onConfirmDelete,
  onDeleted,
}: DeleteResourceDialogProps) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [blockInfo, setBlockInfo] = useState<DeletionCheckResult | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase("closed");
    setBlockInfo(null);
    setConfirmText("");
    setError(null);
  };

  // Not try/finally — see the frontend explainer docs for why this app's
  // React Compiler setup avoids that pattern; the reset is duplicated in
  // both branches instead.
  const openDialog = async () => {
    if (!checkEligibility) {
      setPhase("confirm");
      return;
    }
    setPhase("checking");
    try {
      const result = await checkEligibility();
      if (result.deletable) {
        setPhase("confirm");
      } else {
        setBlockInfo(result);
        setPhase("blocked");
      }
    } catch {
      // The eligibility check is a courtesy for picking the right dialog
      // variant — #destroy itself re-verifies server-side regardless, so
      // failing open to the confirm step is safe, not a security gap.
      setPhase("confirm");
    }
  };

  const handleConfirm = async () => {
    setPhase("deleting");
    setError(null);
    try {
      await onConfirmDelete();
      reset();
      onDeleted();
    } catch (e) {
      setError(extractErrorMessage(e, `Failed to delete this ${resourceLabel}.`));
      setPhase("confirm");
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={openDialog}
        disabled={phase === "checking"}
      >
        {phase === "checking" ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        )}
        Delete
      </Button>

      <AlertDialog open={phase !== "closed" && phase !== "checking"} onOpenChange={(open) => !open && reset()}>
        <AlertDialogContent>
          {phase === "blocked" && blockInfo && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Can't delete this {resourceLabel} yet</AlertDialogTitle>
                <AlertDialogDescription>
                  {blockInfo.reason === "cv_screenings" ? (
                    <>
                      This {resourceLabel} is used by{" "}
                      {blockInfo.blocking_cv_screenings?.length === 1
                        ? "a CV screening"
                        : `${blockInfo.blocking_cv_screenings?.length} CV screenings`}
                      . Delete{" "}
                      {blockInfo.blocking_cv_screenings?.length === 1 ? "it" : "them"} first.
                    </>
                  ) : (
                    "This assessment has existing candidate sessions and can't be deleted."
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {blockInfo.blocking_cv_screenings && blockInfo.blocking_cv_screenings.length > 0 && (
                <ul className="space-y-1.5">
                  {blockInfo.blocking_cv_screenings.map((cs) => (
                    <li
                      key={cs.id}
                      className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm"
                    >
                      <span className="truncate">{cs.name}</span>
                      <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0">
                        <Link to={`/cv-screenings/${cs.id}`}>View →</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <AlertDialogFooter>
                <Button variant="outline" onClick={reset}>Close</Button>
              </AlertDialogFooter>
            </>
          )}

          {(phase === "confirm" || phase === "deleting") && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this {resourceLabel}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can't be undone. This will permanently delete{" "}
                  <strong className="text-foreground">{resourceName}</strong> and all of its data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm-input">
                  Type <strong className="text-foreground">{resourceName}</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm-input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <AlertDialogFooter>
                <Button variant="outline" onClick={reset} disabled={phase === "deleting"}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== resourceName || phase === "deleting"}
                  onClick={handleConfirm}
                >
                  {phase === "deleting" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
