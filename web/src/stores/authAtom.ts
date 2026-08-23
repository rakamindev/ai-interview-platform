import { atom, getDefaultStore } from "jotai";
import { startRefreshTimer } from "@/services/api";

export interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; role: string } | null;
}

export const authAtom = atom<AuthState>({
  accessToken: null,
  user: null
});

const store = getDefaultStore();

export function setAuth(auth: AuthState): void;
export function setAuth(
  accessToken: string,
  user: { id: string; email: string; role: string }
): void;
export function setAuth(
  authOrToken: AuthState | string,
  user?: { id: string; email: string; role: string }
) {
  if (typeof authOrToken === "string" && user) {
    store.set(authAtom, { accessToken: authOrToken, user });
  } else if (typeof authOrToken === "object") {
    store.set(authAtom, authOrToken);
  }
  startRefreshTimer();
}

export function clearAuth() {
  store.set(authAtom, { accessToken: null, user: null });
}

export function getAccessToken(): string | null {
  return store.get(authAtom).accessToken;
}

export function getAuthState(): AuthState {
  return store.get(authAtom);
}

// Kept for backwards compatibility with components that use
// manual subscriptions (e.g. ProtectedRoute).
export function onAuthChange(fn: () => void): () => void {
  const unsub = store.sub(authAtom, () => fn());
  return unsub;
}
