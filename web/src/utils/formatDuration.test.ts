import { describe, it, expect } from "vitest";
import { formatDuration, formatTime } from "./formatDuration";

describe("formatDuration", () => {
  it("renders seconds only under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("renders minutes and seconds under an hour", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(287)).toBe("4m 47s"); // matches STEP 08 verification: "5m 47s" is 347s
    expect(formatDuration(347)).toBe("5m 47s");
  });

  it("renders hours and minutes, dropping seconds, at an hour or more", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(formatDuration(7200)).toBe("2h 0m");
  });
});

describe("formatTime", () => {
  it("formats an ISO timestamp as a short local clock time", () => {
    const result = formatTime("2026-08-18T03:54:00Z");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
