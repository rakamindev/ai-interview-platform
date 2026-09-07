import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Bot, UserCheck, Cloud, Database, KeyRound } from "lucide-react";
import { sessionsApi } from "@/services/sessions";

interface Disclosure {
  version: string;
  recorded: string;
  assessed_by_ai: string;
  human_review: string;
  third_party: string;
  stored: string;
  rights: string;
}

const ICONS = [Mic, Bot, UserCheck, Cloud, Database, KeyRound];
const ORDER: (keyof Disclosure)[] = [
  "recorded",
  "assessed_by_ai",
  "human_review",
  "third_party",
  "stored",
  "rights",
];

/**
 * What this interview does to a candidate's data, shown before it starts.
 *
 * The candidate did not choose this product and cannot opt out of being
 * assessed by it, which is exactly why the disclosure has to come first and be
 * readable rather than buried. UU PDP Pasal 21 requires the subject be informed
 * before processing begins, and an unrecorded consent is not one: if it cannot
 * be produced later it did not happen.
 *
 * Deliberately not a checkbox next to a link. Six sentences, each naming one
 * thing that will happen, in the order it happens.
 */
export default function ConsentGate({
  token,
  onGranted,
}: {
  token: string;
  onGranted: () => void;
}) {
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionsApi
      .getDisclosure(token)
      .then((res) => {
        if (res.data.consent_granted) {
          onGranted();
          return;
        }
        setDisclosure(res.data.disclosure);
      })
      .catch(() => setError("Could not load this page. Please refresh."))
      .finally(() => setLoading(false));
  }, [token, onGranted]);

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await sessionsApi.grantConsent(token);
      onGranted();
    } catch {
      setError("Could not record your agreement. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!disclosure) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-destructive">
        {error ?? "Could not load this page."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Before you start</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here is exactly what this interview does with what you say. Please read it, then decide.
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {ORDER.map((key, i) => {
          const Icon = ICONS[i];
          return (
            <li key={key} className="flex gap-3 px-4 py-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm leading-relaxed">{disclosure[key]}</span>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Declining is a real option and is written as one. A consent that has
            no visible alternative is not a decision the candidate made. */}
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          If you would rather not go ahead, close this page and tell the organisation that invited
          you. Nothing is recorded until you choose to start.
        </p>
        <Button onClick={accept} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          I understand, continue
        </Button>
      </div>
    </div>
  );
}
