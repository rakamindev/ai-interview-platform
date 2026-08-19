import { describe, it, expect } from "vitest";
import { buildInviteUrl } from "@/utils/inviteLink";

describe("buildInviteUrl", () => {
  it("builds the interview link from the frontend's own origin, not any backend value", () => {
    expect(buildInviteUrl("abc123")).toBe(`${window.location.origin}/interview/abc123`);
  });
});
