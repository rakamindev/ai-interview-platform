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
import { Loader2 } from "lucide-react";

interface MyDataDialogProps {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your data</DialogTitle>
          <DialogDescription>
            What we hold about your interview, and your right to delete it under UU PDP.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive py-4">Couldn't load your data. Please try again later.</p>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            {data.data_purged ? (
              <p className="text-sm text-muted-foreground">
                Your personal data has been deleted. Your assessment score is retained by the hiring team, without your name or transcript attached.
              </p>
            ) : (
              <>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Name:</span> {data.candidate_name}</p>
                  {data.verdict && <p><span className="font-medium">Verdict:</span> {data.verdict}</p>}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
                  <div className="space-y-1.5 text-sm max-h-48 overflow-y-auto border rounded-md p-2">
                    {data.transcript.length === 0 && data.transcript_capture_failed ? (
                      <p className="text-destructive">
                        Recording failed during this interview, so nothing was saved. This is a
                        technical failure, not a reflection of your interview.
                      </p>
                    ) : data.transcript.length === 0 ? (
                      <p className="text-muted-foreground">No transcript recorded.</p>
                    ) : (
                      data.transcript.map((turn, i) => (
                        <p key={i}>
                          <span className="font-medium capitalize">{turn.speaker}:</span> {turn.text}
                        </p>
                      ))
                    )}
                  </div>
                </div>

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
                        This removes your name and transcript permanently. Your assessment score stays with the hiring team, without any personal data attached. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete my data</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
