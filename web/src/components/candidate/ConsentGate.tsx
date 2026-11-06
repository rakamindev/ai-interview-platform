import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONSENT_COPY, type CandidateLanguage } from "@/lib/candidateAccess";
import LanguageToggle from "./LanguageToggle";

interface Props {
  language: CandidateLanguage;
  onLanguageChange: (language: CandidateLanguage) => void;
  onConsent: () => Promise<void> | void;
  onBack?: () => void;
  submitting?: boolean;
  error?: string | null;
}

/**
 * Explicit, affirmative consent before any audio or transcript is captured.
 *
 * Consent is recorded server-side (`consent_given_at`) so the audit trail does
 * not depend on a client-side checkbox. The button stays disabled until the
 * candidate actively opts in.
 */
export default function ConsentGate({
  language,
  onLanguageChange,
  onConsent,
  onBack,
  submitting = false,
  error,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const copy = CONSENT_COPY[language];

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <div className="mb-6 flex justify-end">
        <LanguageToggle language={language} onChange={onLanguageChange} />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">{copy.heading}</h1>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          data-testid="consent-checkbox"
        />
        <span>{copy.checkbox}</span>
      </label>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          className="w-full"
          size="lg"
          disabled={!accepted || submitting}
          onClick={() => void onConsent()}
          data-testid="consent-continue"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === "id" ? "Menyimpan..." : "Saving..."}
            </>
          ) : (
            copy.continue
          )}
        </Button>
        {onBack && (
          <Button variant="ghost" className="w-full" onClick={onBack} disabled={submitting}>
            {copy.back}
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {language === "id"
          ? "Persetujuan ini dicatat beserta waktu Anda menyetujuinya."
          : "Your consent is recorded together with the time you gave it."}
      </p>
    </div>
  );
}
