// Minimal localStorage polyfill for the node test environment, so modules that read the auth token
// at import time (services/api → stores/authAtom) load cleanly in tests.
// Note: Node 22+ exposes a built-in `localStorage` that is non-functional without --localstorage-file,
// so we replace it whenever `getItem` isn't callable, not only when it's undefined.
const store = new Map<string, string>();
const stub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

const current = (globalThis as { localStorage?: Storage }).localStorage;
if (!current || typeof current.getItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true, writable: true });
}
