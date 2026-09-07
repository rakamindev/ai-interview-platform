import { useEffect } from "react";

interface UseExitGuardOptions {
  /** Only guard while the interview is genuinely in progress. */
  enabled: boolean;
  /** Called when the candidate tries to navigate away via the back button. */
  onAttemptExit: () => void;
}

/**
 * Stops a candidate from silently losing their one interview attempt.
 *
 * Why this exists (Step 3, Candidate P0): InterviewPage had no navigation guard at
 * all. Pressing back exited immediately, the timer kept running server-side, and
 * reopening the link only offered "End Interview" — never resume.
 *
 * Two exit paths, two mechanisms:
 *   - tab close / refresh  -> `beforeunload`, which shows the browser's own
 *                             "Leave site?" prompt (a custom dialog is not allowed here)
 *   - in-app back button   -> a sentinel history entry that is re-pushed on every
 *                             popstate, so back always lands on our own dialog
 *                             instead of unmounting the interview
 *
 * The guard never touches the timer: choosing "Continue" simply leaves the page
 * mounted and the session untouched.
 */
export function useExitGuard({ enabled, onAttemptExit }: UseExitGuardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by Chrome/Safari for the native prompt to appear.
      event.returnValue = "";
      return "";
    };

    const handlePopState = () => {
      // Put the sentinel back so a second back press is caught too.
      window.history.pushState({ interviewGuard: true }, "");
      onAttemptExit();
    };

    window.history.pushState({ interviewGuard: true }, "");
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, onAttemptExit]);
}
