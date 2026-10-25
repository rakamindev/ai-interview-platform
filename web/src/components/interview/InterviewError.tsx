import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LifeBuoy } from "lucide-react";
import type { InterviewErrorInfo } from "@/types";

interface InterviewErrorProps {
  error: InterviewErrorInfo;
  /** Called when the user chooses to retry a recoverable failure. */
  onRetry?: () => void;
}

/**
 * Terminal error screen for the interview. Rendered instead of the fake
 * "Interview Complete" success message whenever the session failed to start,
 * authenticate, or lost its connection permanently.
 *
 * Copy is mapped per error kind so the candidate gets a truthful, specific
 * message (and, when it helps, a way forward) instead of a misleading success.
 */
export default function InterviewError({ error, onRetry }: InterviewErrorProps) {
  const { kind, code, recoverable } = error;

  let title = "Something went wrong";
  let body =
    "Your interview could not continue. Please contact the interviewer or hiring team for help.";

  switch (kind) {
    case "load_failed":
      title = "Couldn't load your interview";
      body =
        "We couldn't load your interview details. Check your internet connection and try again.";
      break;
    case "auth_failed":
      title = "This interview link isn't valid";
      body =
        "The link may be incorrect or expired. Please contact the interviewer or hiring team to get a new one.";
      break;
    case "resume_unavailable":
      title = "Interview context couldn't be restored";
      body =
        error.message ??
        "The prior conversation context is unavailable. Please contact the interviewer before continuing.";
      break;
    case "microphone_unavailable":
      title = "Microphone disconnected";
      body =
        error.message ??
        "Your microphone became unavailable. Check the browser permission or reconnect the device, then try again.";
      break;
    case "ws_unrecoverable":
      if (code === "no_system_prompt") {
        title = "Interview isn't ready yet";
        body =
          "The assessor hasn't finished setting up this interview. Please contact the hiring team and try again later.";
      } else if (code === "auth_failed") {
        title = "This interview link isn't valid";
        body =
          "The link may be incorrect or expired. Please contact the interviewer or hiring team to get a new one.";
      }
      break;
    case "ws_connection_lost":
      title = "Connection lost";
      body =
        "Your connection to the interview was interrupted and couldn't be restored. Try reconnecting, or contact the interviewer if this keeps happening.";
      break;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="max-w-xl mx-auto px-4 py-16 text-center space-y-4"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>

      <div className="flex items-center justify-center gap-3 pt-2">
        {recoverable && onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Try again
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            // Fallback: prompt the candidate to copy the link for support.
            window.location.reload();
          }}
        >
          <LifeBuoy className="h-4 w-4 mr-2" aria-hidden="true" />
          Reload page
        </Button>
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        If this keeps happening, note the interview link and contact the hiring team.
      </p>
    </div>
  );
}
