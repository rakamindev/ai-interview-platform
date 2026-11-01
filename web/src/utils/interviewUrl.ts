import type { Session } from "@/types";

// Built from the page's own origin, so the link always opens the app the assessor is using.
export function interviewUrl(session: Session) {
  return new URL(`/interview/${encodeURIComponent(session.invite_token)}`, window.location.origin)
    .href;
}
