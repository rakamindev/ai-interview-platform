/**
 * Resolves the canonical full interview URL for a candidate session.
 * Always binds to the active frontend origin (window.location.origin) to prevent
 * URL host/port mismatches between the frontend application and backend API.
 */
export function getInterviewUrl(session?: {
  invite_token?: string | null;
  invite_url?: string | null;
} | null): string {
  if (!session) return "";

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  if (session.invite_token) {
    return origin
      ? `${origin}/interview/${session.invite_token}`
      : `/interview/${session.invite_token}`;
  }

  if (session.invite_url) {
    if (origin) {
      return session.invite_url.replace(/^https?:\/\/[^/]+/, origin);
    }
    return session.invite_url;
  }

  return "";
}
