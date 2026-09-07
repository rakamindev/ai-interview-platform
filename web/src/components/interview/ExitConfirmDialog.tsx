import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ExitPromptSource = "navigation" | "manual";

interface ExitConfirmDialogProps {
  open: boolean;
  /** "navigation" = the candidate pressed back; "manual" = they clicked End Interview. */
  source: ExitPromptSource;
  onContinue: () => void;
  onEnd: () => void;
}

const COPY: Record<ExitPromptSource, { title: string; description: string }> = {
  navigation: {
    title: "Leave the interview?",
    description:
      "You're still in the middle of your interview. Leaving now ends it for good — you won't be able to come back and finish, and the timer keeps running.",
  },
  manual: {
    title: "End the interview?",
    description:
      "This ends your session now. Everything you've answered so far is kept, but you won't be able to add anything after this.",
  },
};

/**
 * The dialog a candidate has to pass through before their one attempt ends.
 *
 * "Continue interview" is the AlertDialogAction (primary weight, first on mobile)
 * because it is the safe choice; ending is deliberately the quieter, red-tinted
 * option. Escape is trapped on purpose — under time pressure, a stray key press
 * should not be able to end a hiring interview.
 */
export default function ExitConfirmDialog({ open, source, onContinue, onEnd }: ExitConfirmDialogProps) {
  const copy = COPY[source];

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        data-testid="exit-confirm-dialog"
        data-source={source}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onEnd}
            className="border-danger-border text-destructive hover:bg-danger-subtle hover:text-destructive"
          >
            End interview
          </AlertDialogCancel>
          <AlertDialogAction onClick={onContinue} autoFocus>
            Continue interview
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
