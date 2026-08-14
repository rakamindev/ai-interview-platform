import { atom } from "jotai";

export interface AuthState {
  token: string | null;
}

const STORAGE_KEY = "auth_token";

export function getStoredToken(): string | null {
  // No VITE_DEV_TOKEN fallback here on purpose: it used to mean logging out
  // (or even just loading the app fresh, never having logged in at all) would
  // silently re-authenticate as whatever token was baked into the build,
  // bypassing the login form entirely. See assessment/gap-analysis.md P1-6.
  return localStorage.getItem(STORAGE_KEY);
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
