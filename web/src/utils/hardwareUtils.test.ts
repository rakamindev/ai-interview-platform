import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import {
  getBrowserInfo,
  getOSInfo,
  checkCamera,
  getCurrentTime,
  getCurrentDate,
} from "./hardwareUtils";

function stubUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua });
}

function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "platform", { configurable: true, value: platform });
}

function stubGetUserMedia(impl: () => Promise<unknown>) {
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: vi.fn(impl),
  });
}

describe("getBrowserInfo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects Chrome and its version", () => {
    stubUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    );
    expect(getBrowserInfo()).toEqual({ browser: "Chrome", version: "126.0.0.0" });
  });

  it("detects Chrome on iOS (CriOS)", () => {
    stubUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.62 Mobile/15E148 Safari/604.1",
    );
    expect(getBrowserInfo().browser).toBe("Chrome");
  });

  it("detects Chrome on Android (CrMo)", () => {
    stubUserAgent(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36 CrMo/126.0.6478.71",
    );
    expect(getBrowserInfo().browser).toBe("Chrome");
  });

  it("detects Firefox and its version", () => {
    stubUserAgent("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0");
    expect(getBrowserInfo()).toEqual({ browser: "Firefox", version: "128.0" });
  });

  it("detects Firefox on iOS (FxiOS)", () => {
    stubUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/128.0 Mobile/15E148 Safari/605.1.15",
    );
    expect(getBrowserInfo().browser).toBe("Firefox");
  });

  it("detects Safari and its version from the Version/ token", () => {
    stubUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    );
    expect(getBrowserInfo()).toEqual({ browser: "Safari", version: "17.4" });
  });

  it("detects Edge (Edg) when no Chrome token is present", () => {
    stubUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/126.0.2592.61");
    expect(getBrowserInfo()).toEqual({ browser: "Edge", version: "126.0.2592.61" });
  });

  it("reports Chrome for real-world Edge user agents (Chrome token wins)", () => {
    stubUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.61",
    );
    expect(getBrowserInfo()).toEqual({ browser: "Chrome", version: "126.0.0.0" });
  });

  it("returns Unknown for unrecognized user agents", () => {
    stubUserAgent("Totally Custom Browser/1.0");
    expect(getBrowserInfo()).toEqual({ browser: "Unknown", version: "" });
  });

  it("yields an empty version when a Chrome token carries no version", () => {
    stubUserAgent("Mozilla/5.0 Chrome browsing");
    expect(getBrowserInfo()).toEqual({ browser: "Chrome", version: "" });
  });

  it("yields an empty version when a Firefox token carries no version", () => {
    stubUserAgent("Mozilla/5.0 Firefox edition");
    expect(getBrowserInfo()).toEqual({ browser: "Firefox", version: "" });
  });

  it("yields an empty version when a Safari token carries no Version/ marker", () => {
    stubUserAgent("Mozilla/5.0 (Macintosh) Safari");
    expect(getBrowserInfo()).toEqual({ browser: "Safari", version: "" });
  });

  it("yields an empty version when an Edge token carries no version", () => {
    stubUserAgent("Mozilla/5.0 Edg preview");
    expect(getBrowserInfo()).toEqual({ browser: "Edge", version: "" });
  });
});

describe("getOSInfo", () => {
  it("detects Windows from the platform", () => {
    stubPlatform("Win32");
    stubUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(getOSInfo()).toBe("Windows");
  });

  it("detects MacOS from the platform", () => {
    stubPlatform("MacIntel");
    stubUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    expect(getOSInfo()).toBe("MacOS");
  });

  it("detects Linux from the platform", () => {
    stubPlatform("Linux x86_64");
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
    expect(getOSInfo()).toBe("Linux");
  });

  it("detects Android from the user agent", () => {
    stubPlatform("");
    stubUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36");
    expect(getOSInfo()).toBe("Android");
  });

  it("detects iOS from the user agent", () => {
    stubPlatform("");
    stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(getOSInfo()).toBe("iOS");
  });

  it("returns Unknown when nothing matches", () => {
    stubPlatform("Commodore64");
    stubUserAgent("Custom/1.0");
    expect(getOSInfo()).toBe("Unknown");
  });
});

describe("checkCamera", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the stream when permission is granted", async () => {
    const stream = { id: "camera-stream" };
    stubGetUserMedia(() => Promise.resolve(stream));
    await expect(checkCamera()).resolves.toBe(stream);
  });

  it("returns null when permission is denied", async () => {
    stubGetUserMedia(() => Promise.reject(new Error("Permission denied")));
    await expect(checkCamera()).resolves.toBeNull();
  });

  it("requests video with a low-resolution profile", async () => {
    const getUserMedia = vi.fn(() => Promise.resolve({ id: "s" }));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: getUserMedia,
    });
    await checkCamera();
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        width: { max: 640 },
        height: { max: 480 },
        frameRate: { max: 20 },
        facingMode: "user",
      },
      audio: true,
    });
  });
});

describe("getCurrentTime / getCurrentDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats the current time in en-US 12-hour format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15, 12, 30, 45));
    expect(getCurrentTime()).toBe("12:30:45 PM");
  });

  it("formats the current date as a long en-US date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15, 9, 0, 0));
    expect(getCurrentDate()).toBe("January 15, 2025");
  });
});
