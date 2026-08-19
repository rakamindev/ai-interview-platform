import { atom } from "jotai";
import { startRefreshTimer } from "@/services/api";

export interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; role: string } | null;
}

export const authAtom = atom<AuthState>({
  accessToken: null,
  user: null
});

let _authState: AuthState = { accessToken: null, user: null };
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

export function setAuth(auth: AuthState): void;
export function setAuth(accessToken: string, user: { id: string; email: string; role: string }): void;
export function setAuth(authOrToken: AuthState | string, user?: { id: string; email: string; role: string }) {
  if (typeof authOrToken === "string" && user) {
    _authState = { accessToken: authOrToken, user };
  } else if (typeof authOrToken === "object") {
    _authState = authOrToken;
  }
  notify();
  startRefreshTimer();
}

export function clearAuth() {
  _authState = { accessToken: null, user: null };
  notify();
}

export function getAccessToken(): string | null {
  return _authState.accessToken;
}

export function getAuthState(): AuthState {
  return _authState;
}

export function onAuthChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
