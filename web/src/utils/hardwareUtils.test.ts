import { describe, it, expect, vi } from "vitest";
import { getBrowserInfo, getOSInfo, checkCamera } from "./hardwareUtils";

function setNavigator(props: { userAgent?: string; platform?: string }) {
  for (const [k, v] of Object.entries(props)) {
    vi.spyOn(navigator, k as "userAgent" | "platform", "get").mockReturnValue(v as string);
  }
}

describe("getBrowserInfo", () => {
  it.each([
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", "Chrome", "120.0.0.0"],
    ["Mozilla/5.0 (Windows NT 10.0; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox", "121.0"],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15", "Safari", "17.2"],
    ["SomethingElse/1.0", "Unknown", ""],
  ])("parses %s", (userAgent, browser, version) => {
    setNavigator({ userAgent });
    expect(getBrowserInfo()).toEqual({ browser, version });
  });

  // Documents current behaviour: Edge UAs contain "Chrome", so they match the Chrome branch first.
  it("reports Edge as Chrome (Edge branch is unreachable)", () => {
    setNavigator({ userAgent: "Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0" });
    expect(getBrowserInfo().browser).toBe("Chrome");
  });
});

describe("getOSInfo", () => {
  it.each([
    ["Win32", "", "Windows"],
    ["MacIntel", "", "MacOS"],
    ["Linux x86_64", "", "Linux"],
    ["", "Mozilla/5.0 (Android 14)", "Android"],
    ["", "Mozilla/5.0 (iPhone; CPU iPhone OS 17)", "iOS"],
    ["", "weird", "Unknown"],
  ])("platform=%j ua=%j → %s", (platform, userAgent, expected) => {
    setNavigator({ platform, userAgent });
    expect(getOSInfo()).toBe(expected);
  });
});

describe("checkCamera", () => {
  it("returns the stream when permission is granted", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    await expect(checkCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: true }));
  });

  it("returns null when permission is denied", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) } });
    await expect(checkCamera()).resolves.toBeNull();
  });
});
