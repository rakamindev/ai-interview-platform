import { atom } from "jotai";
import { queryClient } from "@/lib/queryClient";

export interface AuthState {
  token: string | null;
}

const STORAGE_KEY = "auth_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function saveToken(token: string) {
  queryClient.clear();
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  queryClient.clear();
  localStorage.removeItem(STORAGE_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
});
