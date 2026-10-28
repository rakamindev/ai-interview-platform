import { describe, expect, it } from "vitest";
import { extractInviteToken } from "@/lib/invite";

describe("extractInviteToken", () => {
    it("returns a bare token unchanged", () => {
        expect(extractInviteToken("abc123")).toBe("abc123");
    });

    it("takes the last segment of a full invite URL", () => {
        expect(extractInviteToken("http://localhost:5173/interview/abc123")).toBe("abc123");
        expect(extractInviteToken("https://jobs.example.com/interview/xyz-789/")).toBe("xyz-789");
    });

    it("trims whitespace and handles empty input", () => {
        expect(extractInviteToken("  abc123  ")).toBe("abc123");
        expect(extractInviteToken("")).toBe("");
        expect(extractInviteToken("   ")).toBe("");
    });
});
