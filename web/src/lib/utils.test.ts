import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("merges multiple class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes and filters falsey values", () => {
    expect(cn("base-class", false && "hidden", null, undefined, "active")).toBe("base-class active");
  });

  it("resolves Tailwind conflicting utilities cleanly", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });
});
