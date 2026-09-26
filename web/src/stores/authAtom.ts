import { atom } from "jotai";

export interface AuthUser {
  id?: number;
  email: string;
  role: string;
}

export interface AuthState {
  token: string | null;
  user?: AuthUser | null;
}

const STORAGE_KEY = "auth_token";
const USER_STORAGE_KEY = "auth_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function saveUser(user: AuthUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  user: getStoredUser(),
});
