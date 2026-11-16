import { User } from "@/services/auth";
import { atom } from "jotai";

export interface AuthState {
  token: string | null;
  user: User | null;
}

const STORAGE_KEY = "auth_token";
const USER_KEY = "user"
export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function getStoredUser(): User | null {
  const storedUser = localStorage.getItem(USER_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function saveUserData(user: string){
  localStorage.setItem(USER_KEY, user)
}

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  user: getStoredUser()
});
