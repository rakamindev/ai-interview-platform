import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { sessionsApi, type MyData } from "@/services/sessions";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERDICT_BADGE_CLASSES, VERDICT_LABELS } from "@/utils/verdictBadge";
import type { Verdict } from "@/types";

interface MyDataDialogProps {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isVerdict(value: string | null): value is Verdict {
  return value === "pass" || value === "consider" || value === "failed";
}

export default function MyDataDialog({ token, open, onOpenChange }: MyDataDialogProps) {
  const [data, setData] = useState<MyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    sessionsApi
      .getMyData(token)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, token]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await sessionsApi.deleteMyData(token);
      setData((prev) => (prev ? { ...prev, data_purged: true, candidate_name: null, transcript: [] } : prev));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle>Your data</DialogTitle>
              <DialogDescription className="mt-0.5">
                What we hold about your interview, and your right to delete it under UU PDP.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive py-4">Couldn't load your data. Please try again later.</p>
        )}

        {!loading && !error && data && (
          <div className="space-y-5">
            {data.data_purged ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-green-600 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Your personal data has been deleted. Your assessment score is retained by the
                  hiring team, without your name or transcript attached.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Name
                    </p>
                    <p className="text-sm font-medium mt-0.5 truncate">{data.candidate_name}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Assessment status
                    </p>
                    <div className="mt-1">
                      {data.verdict && isVerdict(data.verdict) ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            VERDICT_BADGE_CLASSES[data.verdict]
                          )}
                        >
                          {VERDICT_LABELS[data.verdict]}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Pending</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Transcript
                  </p>
                  <div className="space-y-2 text-sm max-h-56 overflow-y-auto rounded-lg border p-3 bg-background">
                    {data.transcript.length === 0 && data.transcript_capture_failed ? (
                      <div className="flex items-start gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>
                          Recording failed during this interview, so nothing was saved. This is a
                          technical failure, not a reflection of your interview.
                        </p>
                      </div>
                    ) : data.transcript.length === 0 ? (
                      <p className="text-muted-foreground">No transcript recorded.</p>
                    ) : (
                      data.transcript.map((turn, i) => (
                        <div
                          key={i}
                          className={cn("flex", turn.speaker === "candidate" ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                              turn.speaker === "candidate"
                                ? "bg-primary/10 text-foreground"
                                : "bg-muted text-foreground"
                            )}
                          >
                            <span className="block text-xs font-medium mb-0.5 text-muted-foreground">
                              {turn.speaker === "candidate" ? "You" : "AI"}
                            </span>
                            {turn.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Danger zone
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={deleting}>
                        Delete my data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete your data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes your name and transcript permanently. Your assessment score
                          stays with the hiring team, without any personal data attached. This
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete my data</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
