import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node >= 22 mengekspos global `localStorage` miliknya sendiri (stub tanpa
// method), dan di environment jsdom stub itu menimpa `localStorage` jsdom —
// akses apa pun melempar "localStorage.getItem is not a function". Pasang
// in-memory Storage hanya saat implementasi yang ada tidak benar.
if (typeof localStorage?.getItem !== "function") {
  const store = new Map<string, string>();
  const makeStorage = (): Storage => ({
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => {
      const value = store.get(key);
      return value === undefined ? null : value;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  });
  Object.defineProperty(globalThis, "localStorage", { value: makeStorage(), configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: makeStorage(), configurable: true });
}

// Bersihkan DOM setelah setiap test supaya tidak ada kebocoran state antar test.
afterEach(() => {
  cleanup();
});
