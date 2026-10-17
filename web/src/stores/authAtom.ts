import { atom } from "jotai";

export interface UserProfile {
  id?: number;
  email?: string;
  name?: string;
  picture?: string;
  avatar_url?: string;
  role?: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
}

const STORAGE_KEY = "auth_token";
const USER_KEY = "auth_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw);

    // Fallback: extract from token if available
    const token = getStoredToken();
    if (token && token.includes(".")) {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.email) {
          const rawName = payload.email.split("@")[0].replace(/[._]/g, " ");
          const name = rawName.replace(/\b\w/g, (c: string) => c.toUpperCase());
          return {
            id: payload.user_id,
            email: payload.email,
            name,
            role: payload.role,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function saveUser(user: UserProfile) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  user: getStoredUser(),
});

