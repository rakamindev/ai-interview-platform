import { atom } from "jotai";

export interface AuthState {
  token: string | null;
}

const STORAGE_KEY = "auth_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
});

/** Decode a JWT payload without verifying the signature (client-side UX only). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  const role = decodeJwt(token)?.role;
  return typeof role === "string" && role.length > 0 ? role : null;
}

/** Role claim derived from the stored token. null when absent or unparseable. */
export const authRoleAtom = atom<string | null>((get) => getRoleFromToken(get(authAtom).token));
