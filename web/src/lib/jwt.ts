/**
 * Decodes a JWT payload for UI-only decisions (which home to show, which nav
 * to render). Signature verification is deliberately NOT done here — the API
 * is the sole authority on what a token may access; this is presentation only.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const segment = token.split(".")[1];
    if (!segment) return null;

    try {
        const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/** Returns the role claim ("admin" | "user") or null when absent/undecodable. */
export function roleFromToken(token: string | null | undefined): string | null {
    if (!token) return null;
    const role = decodeJwtPayload(token)?.role;
    return typeof role === "string" ? role : null;
}
