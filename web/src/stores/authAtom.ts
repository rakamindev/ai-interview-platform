import { atom } from "jotai";

export interface UserProfile {
  id?: number;
  email?: string;
  role?: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
}

const STORAGE_KEY = "auth_token";
const USER_STORAGE_KEY = "auth_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? null;
}

export function getStoredUser(): UserProfile | null {
  const data = localStorage.getItem(USER_STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user?: UserProfile) {
  localStorage.setItem(STORAGE_KEY, token);
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

// Fallback helper to decode user payload from JWT if stored user is absent
function decodeTokenUser(token: string | null): UserProfile | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return {
      id: payload.user_id,
      role: payload.role,
      email: payload.email || (payload.role === "admin" ? "admin@example.com" : undefined),
    };
  } catch {
    return null;
  }
}

const initialToken = getStoredToken();
const initialUser = getStoredUser() || decodeTokenUser(initialToken);

export const authAtom = atom<AuthState>({
  token: initialToken,
  user: initialUser,
});
