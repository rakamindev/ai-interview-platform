import { atom } from "jotai";

export interface AuthState {
  token: string | null;
  scheme: string | null;
}

const STORAGE_KEY_TOKEN = "auth_token";
const STORAGE_KEY_SCHEME = "tenant_scheme";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function getStoredScheme(): string | null {
  return localStorage.getItem(STORAGE_KEY_SCHEME) ?? import.meta.env.VITE_DEV_TENANT_SCHEME ?? null;
}

export function saveToken(token: string, scheme: string) {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_SCHEME, scheme);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_SCHEME);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  scheme: getStoredScheme(),
});
