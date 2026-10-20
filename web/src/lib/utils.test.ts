import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins classes and drops falsy ones", () => {
    expect(cn("px-2", false && "hidden", undefined, "text-sm")).toBe("px-2 text-sm");
  });

  it("lets a later Tailwind class win over a conflicting earlier one", () => {
    expect(cn("px-2 text-muted-foreground", "px-4", "text-destructive")).toBe("px-4 text-destructive");
  });
});
