import { afterEach, describe, expect, it, vi } from "vitest";
import { getMicPermissionState } from "@/utils/hardwareUtils";

describe("getMicPermissionState (F10 regression)", () => {
  afterEach(() => {
    // @ts-expect-error — test-only cleanup of a jsdom global we stub per test
    delete navigator.permissions;
  });

  it("returns 'denied' when the Permissions API reports a permanently blocked mic", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "denied" }) },
      configurable: true,
    });

    await expect(getMicPermissionState()).resolves.toBe("denied");
  });

  it("returns 'granted' when access is allowed", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "granted" }) },
      configurable: true,
    });

    await expect(getMicPermissionState()).resolves.toBe("granted");
  });

  it("returns 'unsupported' when the browser has no Permissions API at all", async () => {
    Object.defineProperty(navigator, "permissions", { value: undefined, configurable: true });

    await expect(getMicPermissionState()).resolves.toBe("unsupported");
  });

  it("returns 'unsupported' instead of throwing when permissions.query rejects", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockRejectedValue(new Error("not allowed to query")) },
      configurable: true,
    });

    await expect(getMicPermissionState()).resolves.toBe("unsupported");
  });
});
