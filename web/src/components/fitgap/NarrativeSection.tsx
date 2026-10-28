import { useEffect, useId, useRef, useState } from "react";
import { Loader2, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ClampText } from "@/components/ui/clamp-text";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import type { FitGapNarrative } from "@/types";

const STATUS_LABEL: Record<FitGapNarrative["status"], string> = {
  not_requested: "Not requested",
  generating: "Generating",
  complete: "Ready",
  failed: "Failed",
  outdated: "Outdated",
};

const ERROR_TEXT: Record<string, string> = {
  timeout: "The AI service took too long to respond.",
  rate_limited: "The AI service is busy right now (rate limit reached).",
  provider_denied: "The AI service refused the request (access or quota).",
  provider_unavailable: "The AI service is temporarily unavailable.",
  invalid_output: "The AI returned an answer that could not be used.",
  empty_output: "The AI returned an empty answer.",
};

// The typical time is shown as elapsed time against an estimate, not as real progress.
const TYPICAL_SECONDS = 60;

interface NarrativeSectionProps {
  narrative: FitGapNarrative;
  onRequest: () => void;
  requesting: boolean;
  requestFailed: boolean;
  pollFailed: boolean;
  onCheckAgain: () => void;
}

function GeneratingProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const value = Math.min(Math.round((elapsed / TYPICAL_SECONDS) * 100), 95);

  return (
    <div className="space-y-2">
      <Progress value={value} className="bg-slate-200" aria-label="Narrative progress" aria-valuetext={`${elapsed} seconds elapsed`} />
      <p className="text-sm text-muted-foreground">
        Writing the narrative. This usually takes under a minute ({elapsed}s so far). The comparison above is already final.
      </p>
    </div>
  );
}

function RequestButton({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  const Icon = label.startsWith("Generate") ? Sparkles : RotateCw;
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Icon aria-hidden="true" />}
      {label}
    </Button>
  );
}

function Body({ narrative, onRequest, requesting }: Pick<NarrativeSectionProps, "narrative" | "onRequest" | "requesting">) {
  switch (narrative.status) {
    case "not_requested":
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No narrative yet. The comparison above is complete without it.</p>
          <RequestButton label="Generate narrative" onClick={onRequest} busy={requesting} />
        </div>
      );
    case "generating":
      return <GeneratingProgress />;
    case "failed":
      return (
        <Callout variant="error" title="Narrative could not be generated"
                 action={<RequestButton label="Retry narrative" onClick={onRequest} busy={requesting} />}>
          {`${ERROR_TEXT[narrative.error_code ?? ""] ?? "Something went wrong while writing the narrative."} The comparison above does not depend on it.`}
        </Callout>
      );
    case "outdated":
      return (
        <Callout variant="warning" title="Narrative outdated"
                 action={<RequestButton label="Regenerate narrative" onClick={onRequest} busy={requesting} />}>
          Ratings changed after this narrative was written, so the old text is hidden. The comparison above is current.
        </Callout>
      );
    default: {
      const texts = [narrative.culture, narrative.overall].filter((text): text is string => Boolean(text));
      if (texts.length === 0) return <p className="text-sm text-muted-foreground">No narrative text is available.</p>;
      return (
        <div className="space-y-3 text-sm leading-relaxed">
          {texts.map((text, index) => <ClampText key={index} text={text} lines={6} maxChars={900} />)}
        </div>
      );
    }
  }
}

// The AI narrative, always under its label, with a status announced politely.
export default function NarrativeSection(props: NarrativeSectionProps) {
  const { narrative, onRequest, requestFailed, pollFailed, onCheckAgain } = props;
  const headingId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);

  // The request buttons are replaced by the new status, so keyboard focus
  // moves to the status instead of falling back to the page body.
  const request = () => {
    statusRef.current?.focus();
    onRequest();
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold">AI narrative</h2>
        <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-900">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {narrative.label}
        </span>
      </div>
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" aria-label="Narrative status"
         className="rounded-sm text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Status: <span className="font-medium text-foreground">{STATUS_LABEL[narrative.status]}</span>
      </p>
      <Body {...props} onRequest={request} />
      {requestFailed && (
        <Callout variant="error" role="alert" title="Could not request the narrative">
          Check your connection and try again.
        </Callout>
      )}
      {pollFailed && (
        <ErrorState title="Could not check the narrative status" description="The comparison above is still current."
                    onRetry={onCheckAgain} retryLabel="Check again" className="p-4" />
      )}
    </section>
  );
}
