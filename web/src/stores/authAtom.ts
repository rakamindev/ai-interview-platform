import { atom } from "jotai";

export interface AuthState {
  token: string | null;
  email: string | null;
}

const STORAGE_KEY = "auth_token";
const EMAIL_STORAGE_KEY = "auth_email";

export function getStoredToken(): string | null {
  // Protected routes must only be unlocked by a token saved after a
  // successful login/signup. Do not use a build-time development token here.
  return localStorage.getItem(STORAGE_KEY);
}

export function saveToken(token: string, email?: string) {
  localStorage.setItem(STORAGE_KEY, token);
  if (email) localStorage.setItem(EMAIL_STORAGE_KEY, email);
}

export function clearToken() {
  // Remove the current key and common legacy/alternate auth-token keys too.
  // This prevents a stale token under another key from surviving logout.
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && /(?:^|[_-])(auth|access|refresh)?[_-]?token$/i.test(key)) {
      localStorage.removeItem(key);
    }
  }
  localStorage.removeItem(EMAIL_STORAGE_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  email: localStorage.getItem(EMAIL_STORAGE_KEY),
});
