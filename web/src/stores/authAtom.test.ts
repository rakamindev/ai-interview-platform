import { describe, expect, it } from "vitest";
import { clearToken, getStoredToken, saveToken } from "./authAtom";

describe("auth token storage", () => {
  it("has no token until one is saved", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("saves, reads back and clears the token", () => {
    saveToken("abc.def.ghi");
    expect(getStoredToken()).toBe("abc.def.ghi");

    clearToken();
    expect(getStoredToken()).toBeNull();
  });
});
