import { Link2Off, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// The candidate page's endings other than a finished interview (P2-27). Each says what happened and what the
// candidate can do, and none of them thanks the candidate for an interview that didn't finish.
export type InterviewNoticeKind = "invalid_link" | "load_failed" | "interrupted";

interface InterviewNoticeProps {
  kind: InterviewNoticeKind;
  onRetry?: () => void;
}

export default function InterviewNotice({ kind, onRetry }: InterviewNoticeProps) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <section
        aria-labelledby="interview-notice-title"
        className="rounded-2xl border bg-card px-6 pb-8 pt-10 text-center shadow-sm"
      >
        {kind === "invalid_link" && (
          <>
            <NoticeIcon icon={Link2Off} />
            <h2 id="interview-notice-title" className="text-xl font-semibold">
              This interview link doesn't work
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the full link from your invitation; part of it may be missing. If it still doesn't work, ask the
              hiring team for a new link.
            </p>
          </>
        )}

        {kind === "load_failed" && (
          <>
            <NoticeIcon icon={WifiOff} />
            <h2 id="interview-notice-title" className="text-xl font-semibold">
              We couldn't load your interview
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Check your internet connection and try again.</p>
            <Button className="mt-6" onClick={onRetry}>
              <RefreshCw aria-hidden className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </>
        )}

        {kind === "interrupted" && (
          <>
            <NoticeIcon icon={WifiOff} />
            <h2 id="interview-notice-title" className="text-xl font-semibold">
              The interview was interrupted
            </h2>
            {/* The server keeps the interview open for two minutes after the page leaves (BROWSER_GRACE_PERIOD). */}
            <p className="mt-2 text-sm text-muted-foreground">
              The connection to the interview was lost. What you said so far is saved. Rejoin within 2 minutes to
              continue; after that, the interview ends with the answers you've given.
            </p>
            <Button className="mt-6" onClick={onRetry}>
              <RefreshCw aria-hidden className="mr-2 h-4 w-4" />
              Rejoin the interview
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Your microphone is off. If this keeps happening, contact the hiring team.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function NoticeIcon({ icon: Icon }: { icon: typeof WifiOff }) {
  return (
    <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon aria-hidden className="h-7 w-7" />
    </span>
  );
}
