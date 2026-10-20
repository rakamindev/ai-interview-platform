import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sessionsApi } from "@/services/sessions";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, ShieldCheck } from "lucide-react";
import type { ConsentBlock } from "@/types";

interface ConsentScreenProps {
  token: string;
  consent: ConsentBlock;
  /** Recorded server-side and the socket released. */
  onGranted: () => void;
  /** Candidate declined — the interview must not start. */
  onDeclined: () => void;
}

type Phase = "idle" | "submitting" | "error";

/**
 * The screen a candidate meets before any audio can move.
 *
 * Two deliberate properties: the text is rendered from what the server sent
 * (so what they see is what gets recorded as the agreed version), and a failed
 * request leaves them here rather than quietly letting them through. Consent
 * that fails open is not consent.
 */
export default function ConsentScreen({ token, consent, onGranted, onDeclined }: ConsentScreenProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const agree = async () => {
    if (phase === "submitting") return;
    setPhase("submitting");
    try {
      await sessionsApi.recordConsent(token);
      onGranted();
    } catch {
      setPhase("error");
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Before you begin</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            We need your agreement to assess you with AI. You can refuse, and nothing
            will be recorded.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {consent.summary.map((line) => (
            <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border bg-muted/40">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span>Read the full details</span>
            {detailsOpen ? (
              <ChevronUp className="size-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            )}
          </button>

          {detailsOpen && (
            <dl className="space-y-3 border-t px-3 py-3">
              {consent.details.map((item) => (
                <div key={item.label} className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-foreground">{item.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Version {consent.version}. A record of this agreement, including which
          wording you agreed to and when, is stored with your session.
        </p>

        {phase === "error" && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              We could not save your agreement, so the interview has not started.
              Nothing was recorded. Please try again.
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full"
          size="lg"
          onClick={agree}
          disabled={phase === "submitting"}
        >
          {phase === "submitting" && (
            <Loader2 className="animate-spin" aria-hidden />
          )}
          {phase === "submitting" ? "Saving your agreement…" : "Agree and continue"}
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="w-full text-muted-foreground"
          onClick={onDeclined}
          disabled={phase === "submitting"}
        >
          No thanks, end here
        </Button>

        {phase === "error" && (
          <Button variant="outline" size="lg" className="w-full" onClick={agree}>
            Try again
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
