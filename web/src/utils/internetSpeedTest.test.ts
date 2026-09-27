import { describe, it, expect } from "vitest";
import { classifyConnection } from "@/utils/internetSpeedTest";

// The pre-interview connection classifier (worklog #3). Tiered thresholds sized to the audio stream,
// so typical Indonesian uplinks are not wrongly blocked. Table originally validated during #3.
type Metrics = { download: number | null; upload: number | null; ping: number | null };

const cases: [string, Metrics, string][] = [
  ["real result 31.62/2.67/47 → good", { download: 31.62, upload: 2.67, ping: 47 }, "good"],
  ["comfortable", { download: 10, upload: 5, ping: 60 }, "good"],
  ["exactly at recommended", { download: 2, upload: 1, ping: 300 }, "good"],
  ["upload between min and recommended", { download: 20, upload: 0.8, ping: 80 }, "fair"],
  ["high-ish latency", { download: 20, upload: 5, ping: 600 }, "fair"],
  ["exactly at minimum", { download: 1, upload: 0.5, ping: 1000 }, "fair"],
  ["upload below minimum", { download: 20, upload: 0.3, ping: 50 }, "poor"],
  ["download below minimum", { download: 0.6, upload: 5, ping: 50 }, "poor"],
  ["ping too high", { download: 20, upload: 5, ping: 1500 }, "poor"],
  ["timed-out upload ceiling", { download: 20, upload: 0.25, ping: 50 }, "poor"],
  ["nothing measurable", { download: null, upload: null, ping: null }, "unknown"],
  ["upload endpoint blocked, rest fine", { download: 20, upload: null, ping: 50 }, "unknown"],
  ["upload blocked but download too slow", { download: 0.5, upload: null, ping: 50 }, "poor"],
];

describe("classifyConnection", () => {
  it.each(cases)("%s", (_name, input, expected) => {
    expect(classifyConnection(input)).toBe(expected);
  });
});
