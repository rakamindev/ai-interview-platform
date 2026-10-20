import { describe, expect, it } from "vitest";
import vercel from "../../vercel.json";

// The headers web/vercel.json sends with every page. A Permissions-Policy feature set to () is off for every origin:
// Chrome refuses it before any prompt (getUserMedia rejects with NotAllowedError), whatever the candidate allows.
// A feature the header doesn't name keeps its default, which for these is the page's own origin.

function permissionsPolicy(): Map<string, string> {
  const headers = vercel.headers.find((h) => h.source === "/(.*)")!.headers;
  const value = headers.find((h) => h.key === "Permissions-Policy")!.value;
  return new Map(value.split(",").map((directive) => directive.trim().split("=") as [string, string]));
}

/** Whether the page's own origin may use the feature: not named (default 'self'), or allowed with self or *. */
function allowsSelf(feature: string): boolean {
  const allowlist = permissionsPolicy().get(feature);
  return allowlist === undefined || /\bself\b|\*/.test(allowlist);
}

describe("Production headers (vercel.json)", () => {
  it("let the interview use the microphone", () => {
    expect(allowsSelf("microphone")).toBe(true);
  });

  it("let a proctored interview share the screen and count the screens", () => {
    expect(allowsSelf("display-capture")).toBe(true);
    expect(allowsSelf("window-management")).toBe(true);
  });

  it("keep geolocation off, which nothing uses", () => {
    expect(permissionsPolicy().get("geolocation")).toBe("()");
  });

  it("let a proctored interview use the camera (P1-16)", () => {
    expect(allowsSelf("camera")).toBe(true);
  });
});
