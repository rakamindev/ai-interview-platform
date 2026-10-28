/**
 * Role → route mapping.
 *
 * admin: assessor superuser, full access to the assessor workspace.
 * user:  candidate account, may sign in but only ever sees the candidate
 *        surface (the API independently forbids candidate tokens from every
 *        assessor endpoint — see AuthorizeApiRequest::ASSESSOR_ROLES).
 */
export function isAssessorRole(role: string | null | undefined): boolean {
    return role === "admin";
}

/** Where a signed-in user lands after authenticating. */
export function homePathForRole(role: string | null | undefined): string {
    return isAssessorRole(role) ? "/assessments" : "/candidate";
}
