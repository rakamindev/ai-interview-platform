// The desk says "new" only against the last visit on this device. Storage
// can be missing or blocked, so every read and write is guarded, and the page
// works without it.
const KEY = "rakamin.home.lastVisit";

export function readLastVisit(storage: Storage | undefined = globalThis.localStorage): string | null {
  try {
    const value = storage?.getItem(KEY) ?? null;
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

export function rememberVisit(now: Date, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, now.toISOString());
  } catch {
    // Private windows and blocked storage: "new" is simply not shown.
  }
}
