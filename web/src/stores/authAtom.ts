import { atom } from "jotai";
import { UserInfo } from "@/services/auth";

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function getStoredUser(): UserInfo | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as UserInfo;
  } catch {
    return null;
  }
}

export function saveAuthData(token: string, user: UserInfo) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  user: getStoredUser(),
});
