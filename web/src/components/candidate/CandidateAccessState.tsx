import { AlertTriangle, Clock, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCandidateAccessCopy,
  type CandidateAccessError,
  type CandidateLanguage,
} from "@/lib/candidateAccess";
import LanguageToggle from "./LanguageToggle";

interface Props {
  error: CandidateAccessError;
  language: CandidateLanguage;
  onLanguageChange: (language: CandidateLanguage) => void;
  onRetry?: () => void;
  retrying?: boolean;
}

const ICONS: Record<CandidateAccessError, typeof Clock> = {
  not_found: Link2Off,
  expired: Clock,
  revoked: Link2Off,
  completed: AlertTriangle,
  in_progress: AlertTriangle,
  network: AlertTriangle,
  unknown: AlertTriangle,
};

/**
 * The single honest screen a candidate sees when a link cannot be opened.
 *
 * Before this existed, every failed lookup rendered "Interview Complete",
 * which told candidates who never interviewed that they were done. Each state
 * now explains what happened and what the candidate can do next.
 */
export default function CandidateAccessState({
  error,
  language,
  onLanguageChange,
  onRetry,
  retrying = false,
}: Props) {
  const copy = getCandidateAccessCopy(error, language);
  const Icon = ICONS[error];
  const showRetry = Boolean(copy.retry && onRetry);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6 self-end">
        <LanguageToggle language={language} onChange={onLanguageChange} />
      </div>

      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="h-7 w-7" />
      </div>

      <h1 className="text-xl font-semibold tracking-tight" data-testid="access-title">
        {copy.title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground" data-testid="access-body">
        {copy.body}
      </p>

      {copy.hint && (
        <p className="mt-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          {copy.hint}
        </p>
      )}

      {showRetry && (
        <Button className="mt-6 w-full" onClick={onRetry} disabled={retrying}>
          {retrying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === "id" ? "Mencoba lagi..." : "Trying again..."}
            </>
          ) : language === "id" ? (
            "Coba lagi"
          ) : (
            "Try again"
          )}
        </Button>
      )}
    </div>
  );
}
