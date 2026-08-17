import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { sessionsApi } from "@/services/sessions";
import TranscriptViewer from "@/components/consent/TranscriptViewer";
import { ArrowLeft, Trash2, ShieldCheck, Loader2 } from "lucide-react";

export default function DataPage() {
  const { token } = useParams<{ token: string }>();
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!token || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await sessionsApi.deleteCandidateData(token);
      setDeleted(true);
    } catch {
      setDeleteError("Deletion failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to={`/interview/${token}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Your data</h1>
          <p className="text-xs text-muted-foreground">
            Everything stored from this interview.
          </p>
        </div>
      </div>

      <Separator />

      {deleted ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 space-y-2 text-center">
            <ShieldCheck className="h-8 w-8 text-green-600 mx-auto" />
            <p className="font-medium">Your data has been deleted.</p>
            <p className="text-sm text-muted-foreground">
              The transcript, portfolio and your identity from this interview
              have been removed. No further action is needed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your transcript</CardTitle>
              <CardDescription>
                Read-only. Copy or download it at any time before deletion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptViewer token={token!} />
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Delete all my data
              </CardTitle>
              <CardDescription>
                Permanently deletes this interview's transcript, portfolio and
                your name. This cannot be undone. Without consent, interviews
                default to automatic deletion after 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deleting}>
                    {deleting && (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    )}
                    Delete my data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes your interview transcript, the
                      generated portfolio, and your name from our records. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {deleting ? "Deleting..." : "Delete my data"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {deleteError && (
                <p role="alert" className="text-sm text-destructive mt-2">
                  {deleteError}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
