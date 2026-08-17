/**
 * Route -> shell mapping for the branded loading skeleton.
 *
 * Keep in sync with the route table in `src/App.tsx`:
 *   - Auth routes  : /login, /signup, /access-denied  (AuthShell)
 *   - Interview    : /interview/:token                 (CandidateLayout)
 *   - Everything else                                  (AssessorLayout, default)
 */
export type Shell = "auth" | "interview" | "assessor";

const AUTH_PATHS: ReadonlySet<string> = new Set(["/login", "/signup", "/access-denied"]);

/** True for the two-column AuthShell routes. */
export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.has(pathname);
}

/** True for the candidate interview route (`/interview/:token`). */
export function isInterviewPath(pathname: string): boolean {
  return pathname === "/interview" || pathname.startsWith("/interview/");
}

/** Resolve which shell silhouette a path belongs to; unmatched paths fall back to assessor. */
export function shellForPath(pathname: string): Shell {
  if (isInterviewPath(pathname)) return "interview";
  if (isAuthPath(pathname)) return "auth";
  return "assessor";
}
