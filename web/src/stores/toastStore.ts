import { atom, getDefaultStore } from "jotai";

/**
 * Global toast store (F-26). A tiny, dependency-free toast system backed by
 * jotai so any module — including the axios interceptor — can surface a
 * notification without being inside a React component.
 */
export type ToastKind = "error" | "warning" | "info" | "success";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  /** Optional action shown inside the toast for recoverable failures. */
  onRetry?: () => void;
}

export const toastsAtom = atom<ToastItem[]>([]);

/** Shared jotai store — must be the same store passed to <JotaiProvider>. */
export const store = getDefaultStore();
const TOAST_DURATION_MS = 5000;
let counter = 0;

export function dismissToast(id: number): void {
  store.set(toastsAtom, (prev) => prev.filter((t) => t.id !== id));
}

export function pushToast(item: Omit<ToastItem, "id">): number {
  const id = ++counter;
  store.set(toastsAtom, (prev) => [...prev, { ...item, id }]);
  window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
  return id;
}

/** Convenience helpers — callable from anywhere, including non-React code. */
export const toast = {
  error: (title: string, message?: string, onRetry?: () => void) =>
    pushToast({ kind: "error", title, message, onRetry }),
  warning: (title: string, message?: string) =>
    pushToast({ kind: "warning", title, message }),
  info: (title: string, message?: string) =>
    pushToast({ kind: "info", title, message }),
  success: (title: string, message?: string) =>
    pushToast({ kind: "success", title, message }),
};