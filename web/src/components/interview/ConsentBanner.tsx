import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";

interface ConsentBannerProps {
  onConsentChange?: (consented: boolean) => void;
}

// Candidate-facing UU PDP consent banner (shown before the interview).
// Opt-in/opt-out for AI processing + data-management affordances.
export default function ConsentBanner({ onConsentChange }: ConsentBannerProps) {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const choose = (value: boolean) => {
    setConsented(value);
    onConsentChange?.(value);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white shadow-sm" data-testid="consent-banner">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-sm">Your data, your choice</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This interview is processed by AI to evaluate your responses. Your answers are used only for
            this assessment and are handled in line with Indonesia&apos;s Personal Data Protection Law (UU PDP).
          </p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
            <li>Only relevant interview content is sent to the AI — personal identifiers are removed.</li>
            <li>You can request access to or deletion of your data at any time.</li>
          </ul>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setDismissed(true)} aria-label="Dismiss consent notice">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {consented === null ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => choose(true)}>
            I consent to AI processing
          </Button>
          <Button size="sm" variant="outline" onClick={() => choose(false)}>
            Decline AI processing
          </Button>
        </div>
      ) : consented ? (
        <p className="text-xs text-green-600">Thank you. You may withdraw consent at any time.</p>
      ) : (
        <p className="text-xs text-destructive">
          AI processing declined. A human assessor will review your interview instead.
        </p>
      )}
    </div>
  );
}