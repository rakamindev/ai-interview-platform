import { atom } from "jotai";

export interface AuthState {
  token: string | null;
}

// TODO
const STORAGE_KEY = "auth_token";

export function getStoredToken(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_TOKEN) {
    return import.meta.env.VITE_DEV_TOKEN;
  }

  return null;
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
