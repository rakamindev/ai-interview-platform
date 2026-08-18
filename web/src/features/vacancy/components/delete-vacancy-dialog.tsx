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

import { vacancyMutations } from "../mutations/vacancy";

interface DeleteVacancyDialogProps {
  id: number;
  roleTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteVacancyDialog({ id, roleTitle, open, onOpenChange }: DeleteVacancyDialogProps) {
  const navigate = useNavigate();

  const { mutate: destroy, isPending } = useMutation({
    ...vacancyMutations.destroy(id),
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "Vacancy deleted!",
      });
      navigate({ to: "/vacancies" });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title:
          error.response.status === 422 ? error.data?.errors[0].message : "Failed to delete vacancy. Please try again.",
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
          <AlertDialogTitle>Delete vacancy</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete “{roleTitle || "this vacancy"}”? This action cannot be undone. Existing
            Fit/Gap reports comparing this vacancy will also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={() => destroy()}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
