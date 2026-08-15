import "@testing-library/jest-dom/vitest";

// Node 22+ ships an experimental native `localStorage` that can shadow
// jsdom's own implementation and ends up with a non-functional `.getItem`
// (surfaces as "localStorage.getItem is not a function" the moment any
// module reads it, e.g. src/stores/authAtom.ts on import). Force a plain
// in-memory implementation for the test run so it behaves like a real
// browser regardless of which one wins the global.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), writable: true });
