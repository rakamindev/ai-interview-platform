import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";

import { sessionMutations } from "../mutations/session";
import { sessionQueries } from "../queries/session";

interface EndSessionDialogProps {
  sessionId: number;
  assessmentId: string;
}

export function EndSessionDialog({ sessionId, assessmentId }: EndSessionDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const endSessionMutation = useMutation({
    ...sessionMutations.endSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueries.detailKey(sessionId) });
      navigate({
        to: "/assessments/$assessmentId/sessions/$sessionId/portfolio",
        params: { assessmentId, sessionId: String(sessionId) },
      });
    },
    onError: () => {
      toastManager.add({
        type: "error",
        title: "Failed to end session. Please try again.",
      });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={endSessionMutation.isPending} />}>
        {endSessionMutation.isPending ? "Ending..." : "End Session"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End the session now?</AlertDialogTitle>
          <AlertDialogDescription>
            The interview will stop and portfolio generation will begin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => endSessionMutation.mutate()}>End Session</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
