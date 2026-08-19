import { describe, it, expect } from "vite-plus/test";
import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, 0, "b")).toBe("a b");
  });

  it("handles conditional object syntax", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });

  it("merges tailwind conflicts, keeping the later class", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("accepts arrays", () => {
    expect(cn(["a", "b"])).toBe("a b");
  });

  it("returns an empty string when nothing is passed", () => {
    expect(cn()).toBe("");
  });
});
