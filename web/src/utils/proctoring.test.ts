import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSecondScreen, isDesktopChrome, proctoringSummaryText, requestEntireScreen, watchScreens } from "./proctoring";

// Real user-agent strings, one per browser a candidate might open the link in.
const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  opera: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

const brands = (...names: string[]) => names.map((brand) => ({ brand, version: "130" }));

describe("isDesktopChrome", () => {
  it("accepts Chrome on Windows and macOS", () => {
    expect(isDesktopChrome(UA.chromeWindows, undefined)).toBe(true);
    expect(isDesktopChrome(UA.chromeMac, undefined)).toBe(true);
  });

  it("refuses other browsers that say Chrome in their user agent, and every phone", () => {
    for (const ua of [UA.edge, UA.opera, UA.chromeAndroid, UA.chromeIphone, UA.firefox, UA.safariMac]) {
      expect(isDesktopChrome(ua, undefined), ua).toBe(false);
    }
  });

  it("trusts the browser's own brand list when it has one (Brave's user agent is Chrome's)", () => {
    expect(isDesktopChrome(UA.chromeWindows, { mobile: false, brands: brands("Chromium", "Google Chrome", "Not?A_Brand") })).toBe(true);
    expect(isDesktopChrome(UA.chromeWindows, { mobile: false, brands: brands("Chromium", "Brave", "Not?A_Brand") })).toBe(false);
    expect(isDesktopChrome(UA.chromeAndroid, { mobile: true, brands: brands("Chromium", "Google Chrome") })).toBe(false);
  });
});

describe("requestEntireScreen", () => {
  afterEach(() => vi.restoreAllMocks());

  function shareReturning(displaySurface: string) {
    const track = { stop: vi.fn(), getSettings: () => ({ displaySurface }) };
    const stream = { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getDisplayMedia: vi.fn().mockResolvedValue(stream) },
    });
    return track;
  }

  it("keeps a share of the entire screen", async () => {
    shareReturning("monitor");
    const result = await requestEntireScreen();
    expect(result.ok).toBe(true);
  });

  it("stops and refuses a share of a tab or a window", async () => {
    for (const surface of ["browser", "window"]) {
      const track = shareReturning(surface);
      expect(await requestEntireScreen()).toEqual({ ok: false, reason: "not_entire_screen" });
      expect(track.stop).toHaveBeenCalled();
    }
  });

  it("reports a refused prompt as denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getDisplayMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
    });
    expect(await requestEntireScreen()).toEqual({ ok: false, reason: "denied" });
  });
});

describe("hasSecondScreen and watchScreens", () => {
  afterEach(() => vi.useRealTimers());

  /** A screen as Chrome has it: isExtended, and "change" when a screen is plugged in or out. */
  function chromeScreen(isExtended: boolean | undefined) {
    const events = new EventTarget();
    return {
      isExtended,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      change(next: boolean) {
        this.isExtended = next;
        events.dispatchEvent(new Event("change"));
      },
    };
  }

  it("is true only when Chrome reports more than one screen, and false when it can't tell", () => {
    expect(hasSecondScreen(chromeScreen(true))).toBe(true);
    expect(hasSecondScreen(chromeScreen(false))).toBe(false);
    expect(hasSecondScreen(chromeScreen(undefined))).toBe(false);
  });

  it("calls back when a screen is plugged in or out, and stops after unsubscribing", () => {
    const target = chromeScreen(false);
    const onChange = vi.fn();
    const unsubscribe = watchScreens(onChange, target);

    target.change(true);
    target.change(false);
    unsubscribe();
    target.change(true);

    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it("checks every few seconds too, in case Chrome doesn't fire the event", () => {
    vi.useFakeTimers();
    const target = chromeScreen(false);
    const onChange = vi.fn();
    const unsubscribe = watchScreens(onChange, target);

    target.isExtended = true; // no event
    vi.advanceTimersByTime(5000);
    expect(onChange).toHaveBeenLastCalledWith(true);

    unsubscribe();
    onChange.mockClear();
    vi.advanceTimersByTime(10000);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("proctoringSummaryText", () => {
  const off = (stops: number, off_seconds: number) => ({ stops, off_seconds });

  it("says when both stayed on, and that Chrome saw one screen when the API reports it", () => {
    expect(proctoringSummaryText({ camera: off(0, 0), screen: off(0, 0) })).toBe(
      "Camera and screen sharing stayed on throughout the interview."
    );
    expect(proctoringSummaryText({ camera: off(0, 0), screen: off(0, 0), second_screen: { connected: 0, seconds: 0 } })).toBe(
      "Camera and screen sharing stayed on throughout the interview, and Chrome saw no second screen."
    );
  });

  it("says how often and how long a second screen was connected", () => {
    expect(proctoringSummaryText({ camera: off(1, 10), screen: off(0, 0), second_screen: { connected: 2, seconds: 95 } })).toBe(
      "The camera was off once (10 s in total); a second screen was connected twice (1 min 35 s in total). " +
        "The interview paused each time until it was put right."
    );
  });

  it("says how often and how long each was off", () => {
    expect(proctoringSummaryText({ camera: off(2, 80), screen: off(1, 35) })).toBe(
      "The camera was off twice (1 min 20 s in total); screen sharing stopped once (35 s in total). " +
        "The interview paused each time until it was put right."
    );
    expect(proctoringSummaryText({ camera: off(0, 0), screen: off(3, 120) })).toMatch(/^Screen sharing stopped 3 times \(2 min in total\)\./);
  });
});
