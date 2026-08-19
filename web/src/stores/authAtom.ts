import { atom } from "jotai";

export interface AuthState {
  authenticated: boolean;
}

const AUTH_FLAG = "authenticated";

export function getDevToken(): string | null {
  if (import.meta.env.DEV) return import.meta.env.VITE_DEV_TOKEN ?? null;
  return null;
}

export function isAuthenticated(): boolean {
  if (localStorage.getItem(AUTH_FLAG) === "true") return true;
  return !!getDevToken();
}

export function setAuthenticated() {
  localStorage.setItem(AUTH_FLAG, "true");
}

export function clearAuth() {
  localStorage.removeItem(AUTH_FLAG);
}

export const authAtom = atom<AuthState>({
  authenticated: isAuthenticated(),
});

export const logoutAtom = atom(null, (_get, set) => {
  clearAuth();
  set(authAtom, { authenticated: false });
});
