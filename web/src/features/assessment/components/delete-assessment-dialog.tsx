import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";

import { assessmentMutations } from "../mutations/assessment";

interface DeleteAssessmentDialogProps {
  id: number;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAssessmentDialog({ id, name, open, onOpenChange }: DeleteAssessmentDialogProps) {
  const navigate = useNavigate();

  const { mutate: destroy, isPending } = useMutation({
    ...assessmentMutations.destroy(),
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "Assessment deleted!",
      });
      navigate({ to: "/assessments" });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title:
          error.response.status === 422
            ? error.data?.errors[0].message
            : "Failed to delete assessment. Please try again.",
      });
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete assessment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete “{name || "this assessment"}”? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={() => destroy(id)}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
