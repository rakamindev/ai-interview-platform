import { atom } from "jotai";

export interface AuthState {
  token: string | null;
}

const STORAGE_KEY = "auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return import.meta.env.VITE_DEV_TOKEN ?? null;
  }
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function saveToken(token: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, token);
  }
}

export function clearToken() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
});
