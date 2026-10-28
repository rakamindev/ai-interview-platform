/** Accepts a full invite URL or a bare invite token. */
export function extractInviteToken(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    if (!value.includes("/")) return value;
    const segments = value.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
}
