/**
 * The backend's invite_url is built from APP_BASE_URL (the API's own origin),
 * which is wrong whenever the API and web app run on different hosts. Always
 * reconstruct the candidate-facing link from the frontend's own origin.
 */
export function buildInviteUrl(inviteToken: string): string {
  return `${window.location.origin}/interview/${inviteToken}`;
}
