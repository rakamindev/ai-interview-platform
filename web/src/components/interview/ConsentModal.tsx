import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, UserCheck, Lock } from "lucide-react";

interface ConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmConsent: () => void;
  onDecline?: () => void;
}

// Candidate-facing gating modal dialog before starting the interview.
// Compliant with Indonesia's Personal Data Protection Law (UU No. 27/2022 / UU PDP).
export default function ConsentModal({
  open,
  onOpenChange,
  onConfirmConsent,
  onDecline,
}: ConsentModalProps) {
  const handleDecline = () => {
    onDecline?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirmConsent();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="consent-modal">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <DialogTitle className="text-lg">Your data, your choice</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            AI Processing &amp; Data Privacy Notice (UU PDP Compliant)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            Before entering the interview room, please review and confirm how your voice and response data will be handled:
          </p>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground font-medium block">Voice &amp; Response Evaluation</strong>
                <span>Your voice responses are transcribed and evaluated in real-time by AI models specifically for this assessment.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground font-medium block">UU PDP Data Privacy Protection</strong>
                <span>Processed strictly under Indonesia&apos;s Personal Data Protection Law (UU No. 27/2022). Identifiers are pseudonymized and data is never sold.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <UserCheck className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground font-medium block">Human Assessor in the Loop</strong>
                <span>All AI-generated scores serve as evidence-backed aids with final review retained by certified human assessors.</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline / Go Back
          </Button>
          <Button size="sm" className="font-semibold" onClick={handleConfirm}>
            I consent to AI processing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
