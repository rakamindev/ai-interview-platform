import { useState, type ReactElement, type MouseEvent } from "react";
import { useToast } from "@/components/ui/toast";
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

interface ConfirmActionDialogProps {
  trigger: ReactElement;
  title: string;
  description: string;
  actionLabel: string;
  errorMessage: string;
  successMessage?: string;
  onConfirm: () => Promise<void>;
}

export default function ConfirmActionDialog({
  trigger,
  title,
  description,
  actionLabel,
  errorMessage,
  successMessage,
  onConfirm,
}: ConfirmActionDialogProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const confirm = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setPending(true);
    setError(false);
    try {
      await onConfirm();
      if (successMessage) toast.success(successMessage);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!pending) {
        setOpen(nextOpen);
        if (nextOpen) setError(false);
      }
    }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {pending ? "Deleting…" : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
