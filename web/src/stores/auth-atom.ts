import { atom } from "jotai";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

const TOKEN_STORAGE_KEY = "auth_token";
const USER_STORAGE_KEY = "auth_user";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? null;
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: AuthUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  user: getStoredUser(),
});
