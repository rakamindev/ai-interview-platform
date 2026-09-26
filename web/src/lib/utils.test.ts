import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps the last of two conflicting Tailwind classes", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("drops empty and false values", () => {
    expect(cn("block", false, undefined, "", "mt-2")).toBe("block mt-2");
  });
});
