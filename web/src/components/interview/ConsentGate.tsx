import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ConsentGateProps {
  /** Called when the candidate agrees. Parent records consent via API. */
  onAgree: () => Promise<void> | void;
}

/**
 * UU PDP consent gate — shown before any interview interaction.
 * The checkbox must be ticked before Continue becomes clickable;
 * the parent is responsible for persisting the consent server-side.
 */
export default function ConsentGate({ onAgree }: ConsentGateProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      await onAgree();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-3 text-sm">
        <p className="font-medium">Before we start</p>
        <ul className="space-y-1.5 text-muted-foreground text-sm list-disc pl-4">
          <li>Your interview is transcribed and analyzed by AI to assess your skills.</li>
          <li>The transcript is shared with the hiring team and processed by Google's AI service.</li>
          <li>You can request deletion of your data at any time.</li>
        </ul>
        <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
          <input
            type="checkbox"
            aria-label="Consent checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            I agree to my interview being transcribed and AI-analyzed for assessment purposes.
          </span>
        </label>
      </div>
      <Button
        className="w-full"
        size="lg"
        disabled={!checked || submitting}
        onClick={handleContinue}
      >
        {submitting ? "Recording consent..." : "Continue"}
      </Button>
    </div>
  );
}
