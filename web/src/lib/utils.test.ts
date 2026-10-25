import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes while preserving conditional classes", () => {
    expect(cn("px-2", "px-4", false && "hidden", "text-sm")).toBe("px-4 text-sm");
  });
});
