import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
    it("joins conditional class names", () => {
        expect(cn("px-4", false && "hidden", "py-2")).toBe("px-4 py-2");
    });

    it("keeps the last conflicting Tailwind utility", () => {
        // The design system relies on this: callers pass base classes and
        // override them per screen without producing dead CSS.
        expect(cn("p-2", "p-4")).toBe("p-4");
        expect(cn("text-sm", "text-lg", "font-medium")).toBe("text-lg font-medium");
    });

    it("returns an empty string when nothing is given", () => {
        expect(cn()).toBe("");
    });
});
