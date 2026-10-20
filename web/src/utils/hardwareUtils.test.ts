import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserInfo, getOSInfo } from "./hardwareUtils";

// Real user-agent strings, shortened only where the tail doesn't matter.
const UA = {
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
};

function useBrowser(userAgent: string, platform: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
}

afterEach(() => vi.restoreAllMocks());

describe("getBrowserInfo", () => {
  it("recognises Chrome, Firefox and Safari with their versions", () => {
    useBrowser(UA.chrome, "Win32");
    expect(getBrowserInfo()).toEqual({ browser: "Chrome", version: "129.0.0.0" });

    useBrowser(UA.firefox, "Win32");
    expect(getBrowserInfo()).toEqual({ browser: "Firefox", version: "131.0" });

    useBrowser(UA.safari, "MacIntel");
    expect(getBrowserInfo()).toEqual({ browser: "Safari", version: "17.6" });
  });

  // Edge's user agent also contains "Chrome", which is checked first.
  it.fails("recognises Edge (known defect, P3: shown to the candidate as Chrome)", () => {
    useBrowser(UA.edge, "Win32");
    expect(getBrowserInfo().browser).toBe("Edge");
  });
});

describe("getOSInfo", () => {
  it("recognises desktop platforms", () => {
    useBrowser(UA.chrome, "Win32");
    expect(getOSInfo()).toBe("Windows");

    useBrowser(UA.safari, "MacIntel");
    expect(getOSInfo()).toBe("MacOS");
  });

  // Android phones report a "Linux armv8l" platform, which is checked first.
  it.fails("recognises Android phones (known defect, P3: shown as Linux)", () => {
    useBrowser(UA.android, "Linux armv8l");
    expect(getOSInfo()).toBe("Android");
  });
});
