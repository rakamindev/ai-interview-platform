import { atom } from "jotai";

export interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; role: string } | null;
}

export const authAtom = atom<AuthState>({
  accessToken: null,
  user: null
});

export function setAuth(accessToken: string, user: { id: string; email: string; role: string }) {
  authAtom.set({ accessToken, user });
}

export function clearAuth() {
  authAtom.set({ accessToken: null, user: null });
}

export function getAccessToken(): string | null {
  return authAtom.get().accessToken;
}
