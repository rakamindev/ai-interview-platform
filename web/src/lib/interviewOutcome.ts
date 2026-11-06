// W26: the candidate must be told what actually happened when the interview screen closes.
// Previously every ending (bad link, server error, lost connection, normal end) showed
// "Interview Complete — the interview has been recorded."

/** What the page observed when the interview ended or could not start. */
export type EndSignal =
  | { kind: "candidate_ended" } // the candidate pressed End
  | { kind: "session_ended"; reason?: string } // the server closed the session and said why
  | { kind: "server_error" } // the server sent a non-recoverable error
  | { kind: "connection_lost" } // every reconnect attempt failed
  | { kind: "link_not_found" } // the invite token does not exist (404)
  | { kind: "link_load_failed" } // the invite could not be loaded (network or server error)
  | { kind: "already_ended" }; // the invite belongs to a session that has already ended

export type InterviewOutcome =
  | "completed"
  | "interrupted"
  | "invalid_link"
  | "load_failed"
  | "already_ended";

export function outcomeFor(signal: EndSignal): InterviewOutcome {
  switch (signal.kind) {
    case "candidate_ended":
      return "completed";
    case "session_ended":
      // The server ends a session normally (time limit, all skills covered, candidate ended) with a
      // reason; only "error" means it did not finish properly.
      return signal.reason === "error" ? "interrupted" : "completed";
    case "server_error":
    case "connection_lost":
      return "interrupted";
    case "link_not_found":
      return "invalid_link";
    case "link_load_failed":
      return "load_failed";
    case "already_ended":
      return "already_ended";
  }
}

export interface EndScreen {
  tone: "success" | "neutral" | "warning";
  title: string;
  body: string;
}

// Only "completed" says the interview reached the hiring team. Opening an already-ended session
// cannot tell a normal end from an error, so that screen stays neutral rather than guessing.
const SCREENS: Record<InterviewOutcome, EndScreen> = {
  completed: {
    tone: "success",
    title: "Interview complete",
    body: "Thank you. Your interview has ended and your answers were sent to the hiring team, who will follow up with you.",
  },
  interrupted: {
    tone: "warning",
    title: "Your interview didn't finish",
    body: "The interview stopped before it was completed. Please contact the hiring team who invited you so they can help you continue.",
  },
  invalid_link: {
    tone: "warning",
    title: "This interview link isn't valid",
    body: "Check that you used the full link from your invitation. If it still doesn't work, contact the hiring team who sent it.",
  },
  load_failed: {
    tone: "warning",
    title: "We couldn't load your interview",
    body: "Check your internet connection and reload this page. Your interview has not started, so nothing is lost.",
  },
  already_ended: {
    tone: "neutral",
    title: "This interview has already ended",
    body: "This link can't be used again. If you have questions, contact the hiring team who invited you.",
  },
};

export function endScreen(outcome: InterviewOutcome): EndScreen {
  return SCREENS[outcome];
}
