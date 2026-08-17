import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createStore } from "jotai";
import {
  authAtom,
  authRoleAtom,
  getStoredToken,
  saveToken,
  clearToken,
  decodeJwt,
  getRoleFromToken,
} from "./authAtom";

function base64url(obj: object) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeToken(payload: object) {
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.signature`;
}

async function freshAuthModule() {
  vi.resetModules();
  return import("./authAtom");
}

describe("authAtom token persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_DEV_TOKEN", undefined);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null when no token is stored and no dev token is configured", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("round-trips a token through localStorage", () => {
    saveToken("abc.def.ghi");
    expect(getStoredToken()).toBe("abc.def.ghi");
    expect(localStorage.getItem("auth_token")).toBe("abc.def.ghi");
  });

  it("returns null after the token is cleared", () => {
    saveToken("abc.def.ghi");
    clearToken();
    expect(getStoredToken()).toBeNull();
  });

  it("seeds the atom from a token already in localStorage", async () => {
    localStorage.setItem("auth_token", "seeded.token");
    const { authAtom: freshAuthAtom } = await freshAuthModule();
    expect(createStore().get(freshAuthAtom)).toEqual({ token: "seeded.token" });
  });

  it("starts with a null token when nothing is stored", async () => {
    const { authAtom: freshAuthAtom } = await freshAuthModule();
    expect(createStore().get(freshAuthAtom)).toEqual({ token: null });
  });
});

describe("decodeJwt", () => {
  it("decodes the payload of a valid token", () => {
    const token = makeToken({ role: "admin", sub: 1 });
    expect(decodeJwt(token)).toEqual({ role: "admin", sub: 1 });
  });

  it("returns null when the token has no payload segment", () => {
    expect(decodeJwt("no-dots-here")).toBeNull();
    expect(decodeJwt("")).toBeNull();
  });

  it("returns null when the payload is not valid base64", () => {
    expect(decodeJwt("a.!!!.c")).toBeNull();
  });

  it("returns null when the payload is not valid JSON", () => {
    expect(decodeJwt("a.not-json.c")).toBeNull();
  });
});

describe("getRoleFromToken / authRoleAtom", () => {
  it("returns null for a null token", () => {
    expect(getRoleFromToken(null)).toBeNull();
  });

  it("returns null for a token without a role claim", () => {
    const token = makeToken({ sub: 1 });
    expect(getRoleFromToken(token)).toBeNull();
  });

  it("returns null when the role claim is not a string", () => {
    const token = makeToken({ role: 42 });
    expect(getRoleFromToken(token)).toBeNull();
  });

  it("returns the role from a valid token", () => {
    const token = makeToken({ role: "candidate" });
    expect(getRoleFromToken(token)).toBe("candidate");
  });

  it("derives the role atom from the auth atom", () => {
    const store = createStore();
    store.set(authAtom, { token: makeToken({ role: "admin" }) });
    expect(store.get(authRoleAtom)).toBe("admin");
  });

  it("derives null when the auth atom has no token", () => {
    const store = createStore();
    store.set(authAtom, { token: null });
    expect(store.get(authRoleAtom)).toBeNull();
  });
});
