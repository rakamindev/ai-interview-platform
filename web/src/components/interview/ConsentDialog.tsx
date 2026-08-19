import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";

interface ConsentDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  submitting?: boolean;
}

export default function ConsentDialog({ open, onAccept, onDecline, submitting = false }: ConsentDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Before we start: how your data is used</DialogTitle>
          </div>
          <DialogDescription>
            This interview processes personal data under Indonesia's Personal Data Protection Law (UU PDP No. 27/2022).
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-foreground/90 space-y-2 leading-relaxed">
          <li>• We record your <strong>voice</strong> and generate a <strong>text transcript</strong> of this interview, together with your name.</li>
          <li>• Your voice is streamed in real time to <strong>Google's Gemini AI</strong> to run the interview — this means your data is processed outside Indonesia.</li>
          <li>• This data is used only to evaluate your interview and is shared with the hiring team for that assessment.</li>
          <li>• You can request access to or deletion of your data by contacting the hiring team after your interview.</li>
        </ul>

        <p className="text-xs text-muted-foreground">
          Read the full{" "}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          for details on retention and your rights.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onDecline} disabled={submitting}>
            Decline
          </Button>
          <Button onClick={onAccept} disabled={submitting}>
            I consent, continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
