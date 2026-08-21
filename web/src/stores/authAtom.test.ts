vi.mock("@/services/api", () => ({ startRefreshTimer: vi.fn() }));

vi.hoisted(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null
    },
    configurable: true
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setAuth, clearAuth, getAccessToken, getAuthState, onAuthChange } from "./authAtom";

const user = { id: "1", email: "test@test.com", role: "candidate" as const };

beforeEach(() => {
  clearAuth();
});

describe("authAtom", () => {
  it("setAuth updates state and notifies listeners", () => {
    const listener = vi.fn();
    const unsub = onAuthChange(listener);
    setAuth("tok-1", user);
    expect(getAuthState()).toEqual({ accessToken: "tok-1", user });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("clearAuth resets state and notifies listeners", () => {
    setAuth("tok-1", user);
    const listener = vi.fn();
    const unsub = onAuthChange(listener);
    clearAuth();
    expect(getAuthState()).toEqual({ accessToken: null, user: null });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("getAccessToken returns current token", () => {
    expect(getAccessToken()).toBeNull();
    setAuth("tok-abc", user);
    expect(getAccessToken()).toBe("tok-abc");
  });

  it("supports overloaded setAuth with AuthState object", () => {
    setAuth({ accessToken: "obj-tok", user });
    expect(getAccessToken()).toBe("obj-tok");
    expect(getAuthState()).toEqual({ accessToken: "obj-tok", user });
  });

  it("multiple listeners all receive notifications", () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const u1 = onAuthChange(l1);
    const u2 = onAuthChange(l2);
    setAuth("tok", user);
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    u1();
    u2();
  });

  it("unsubscribed listener is no longer called", () => {
    const listener = vi.fn();
    const unsub = onAuthChange(listener);
    unsub();
    setAuth("tok", user);
    expect(listener).not.toHaveBeenCalled();
  });
});
